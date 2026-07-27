import assert from "node:assert/strict";
import test from "node:test";

import worker from "../worker/index.js";

const PERMANENT_POST_EXPIRES_AT = 253402300799000;

function createAssets(files) {
  return {
    async fetch(request) {
      const url = new URL(request.url);
      const file = files.get(url.pathname);

      if (!file) {
        return new Response("Not found", { status: 404 });
      }

      return new Response(file.body, {
        status: 200,
        headers: { "content-type": file.contentType },
      });
    },
  };
}

const files = new Map([
  ["/index.html", { body: "<main>Kawan Campus</main>", contentType: "text/html" }],
  ["/assets/app.js", { body: "console.log('ready')", contentType: "text/javascript" }],
]);

function createStorage(seed = {}) {
  const state = {
    posts: structuredClone(seed.posts || []),
    postImages: structuredClone(seed.postImages || []),
    pendingUploads: structuredClone(seed.pendingUploads || []),
    clubAccounts: structuredClone(seed.clubAccounts || []),
    clubSessions: structuredClone(seed.clubSessions || []),
    clubApplications: structuredClone(seed.clubApplications || []),
    reports: structuredClone(seed.reports || []),
    adminUsers: structuredClone(seed.adminUsers || []),
    adminSessions: structuredClone(seed.adminSessions || []),
    auditLogs: structuredClone(seed.auditLogs || []),
    rateLimits: structuredClone(seed.rateLimits || []),
    objects: new Map(),
  };

  function prepare(sql) {
    const compactSql = sql.replace(/\s+/g, " ").trim();
    return {
      sql: compactSql,
      values: [],
      bind(...values) {
        this.values = values;
        return this;
      },
      async all() {
        if (compactSql.includes("FROM pending_uploads WHERE expires_at <= ?")) {
          return { results: state.pendingUploads.filter((row) => row.expires_at <= this.values[0]) };
        }
        if (compactSql.includes("FROM pending_uploads") && compactSql.includes("session_hash = ?")) {
          return {
            results: state.pendingUploads
              .filter((row) => row.session_hash === this.values[0] && row.expires_at > this.values[1])
              .sort((a, b) => a.position - b.position || a.created_at - b.created_at)
              .slice(0, 13),
          };
        }
        if (compactSql.includes("SELECT * FROM posts WHERE")) {
          const category = compactSql.includes("category = ?") ? this.values[1] : null;
          return {
            results: state.posts
              .filter((row) => row.status === this.values[0]
                && (!category || row.category === category))
              .sort((a, b) => b.created_at - a.created_at)
              .slice(0, 80),
          };
        }
        if (compactSql.includes("FROM post_images") && compactSql.includes("post_id IN")) {
          return {
            results: state.postImages
              .filter((row) => this.values.includes(row.post_id))
              .sort((a, b) => a.post_id.localeCompare(b.post_id) || a.position - b.position),
          };
        }
        if (compactSql.includes("FROM posts")
          && compactSql.includes("moderation_note")
          && compactSql.includes("ORDER BY COALESCE(moderated_at, created_at) DESC")) {
          const hasStatus = compactSql.includes("status = ?");
          const hasSearch = compactSql.includes("LOWER(title) LIKE ?");
          let cursor = 0;
          const status = hasStatus ? this.values[cursor++] : null;
          const search = hasSearch
            ? String(this.values[cursor] || "")
              .replace(/^%|%$/g, "")
              .replace(/!([!%_])/g, "$1")
              .toLowerCase()
            : "";
          if (hasSearch) cursor += 4;
          const limit = this.values[cursor];
          const offset = this.values[cursor + 1];
          return {
            results: [...state.posts]
              .filter((row) => {
                if (status && row.status !== status) return false;
                if (!search) return true;
                return [
                  row.title,
                  row.club_name,
                  row.id,
                  row.area,
                ].filter(Boolean).join(" ").toLowerCase().includes(search);
              })
              .sort(
                (a, b) => (b.moderated_at || b.created_at) - (a.moderated_at || a.created_at),
              )
              .slice(offset, offset + limit)
              .map((row) => ({
                ...row,
                report_count: state.reports.filter(
                  (report) => report.post_id === row.id,
                ).length,
              })),
          };
        }
        if (compactSql.includes("FROM reports")
          && compactSql.includes("LEFT JOIN posts")
          && compactSql.includes("post_description")) {
          const hasStatus = compactSql.includes("WHERE reports.status = ?");
          const [status, limit, offset] = hasStatus
            ? this.values
            : [null, this.values[0], this.values[1]];
          return {
            results: [...state.reports]
              .filter((row) => !status || row.status === status)
              .sort((a, b) => (a.status === "pending" ? -1 : 1)
                - (b.status === "pending" ? -1 : 1) || b.created_at - a.created_at)
              .slice(offset, offset + limit)
              .map((row) => {
                const post = state.posts.find((item) => item.id === row.post_id);
                return {
                  ...row,
                  post_title: post?.title || null,
                  post_category: post?.category || null,
                  post_description: post?.description || null,
                  post_area: post?.area || null,
                  post_contact_type: post?.contact_type || null,
                  post_contact: post?.contact || null,
                  post_image_key: post?.image_key || null,
                  post_status: post?.status || null,
                };
              }),
          };
        }
        if (compactSql.includes("FROM audit_logs")
          && compactSql.includes("ORDER BY audit_logs.created_at DESC")) {
          const [limit, offset] = this.values;
          return {
            results: [...state.auditLogs]
              .sort((a, b) => b.created_at - a.created_at)
              .map((row) => ({
                ...row,
                actor_email: state.adminUsers.find(
                  (user) => user.id === row.actor_user_id,
                )?.email || null,
              }))
              .slice(offset, offset + limit),
          };
        }
        if (compactSql.includes("FROM club_accounts") && compactSql.includes("ORDER BY updated_at")) {
          return {
            results: [...state.clubAccounts]
              .sort((a, b) => b.updated_at - a.updated_at || a.name.localeCompare(b.name)),
          };
        }
        if (compactSql.includes("FROM club_applications") && compactSql.includes("ORDER BY CASE")) {
          return {
            results: [...state.clubApplications]
              .sort((a, b) => (a.status === "pending" ? -1 : 1)
                - (b.status === "pending" ? -1 : 1) || b.created_at - a.created_at)
              .slice(0, 100),
          };
        }
        return { results: [] };
      },
      async first(column) {
        let row = null;
        if (compactSql.startsWith("INSERT INTO rate_limits")) {
          const [key_hash, action, window_start, expires_at] = this.values;
          const existing = state.rateLimits.find(
            (item) => item.key_hash === key_hash
              && item.action === action
              && item.window_start === window_start,
          );
          if (existing) {
            existing.count += 1;
            if (compactSql.includes("expires_at = excluded.expires_at")) {
              existing.expires_at = expires_at;
            }
            row = { count: existing.count };
          } else {
            state.rateLimits.push({
              key_hash, action, window_start, count: 1, expires_at,
            });
            row = { count: 1 };
          }
        } else if (compactSql.includes("COUNT(*) AS count FROM pending_uploads")) {
          row = {
            count: state.pendingUploads.filter(
              (item) => item.session_hash === this.values[0] && item.expires_at > this.values[1],
            ).length,
          };
        } else if (compactSql.includes("SELECT owner_token_hash, image_key FROM posts")) {
          row = state.posts.find((item) => item.id === this.values[0]) || null;
        } else if (compactSql.includes("SELECT id FROM posts")
          && compactSql.includes("status = 'published'")) {
          row = state.posts.find(
            (item) => item.id === this.values[0]
              && item.status === "published",
          ) || null;
        } else if (compactSql.includes("SELECT posts.id FROM posts")
          && compactSql.includes("posts.status = 'published'")) {
          const [primaryKey, galleryKey] = this.values;
          row = state.posts.find(
            (item) => item.status === "published"
              && (item.image_key === primaryKey || state.postImages.some(
                (image) => image.post_id === item.id && image.image_key === galleryKey,
              )),
          ) || null;
        } else if (compactSql.includes("SELECT posts.id FROM posts")
          && compactSql.includes("WHERE posts.image_key = ?")) {
          const [primaryKey, galleryKey] = this.values;
          row = state.posts.find(
            (item) => item.image_key === primaryKey || state.postImages.some(
              (image) => image.post_id === item.id && image.image_key === galleryKey,
            ),
          ) || null;
        } else if (compactSql.includes("FROM club_sessions AS sessions")
          && compactSql.includes("INNER JOIN club_accounts")) {
          const session = state.clubSessions.find(
            (item) => item.token_hash === this.values[0]
              && item.expires_at > this.values[1]
              && item.revoked_at == null,
          );
          const account = session
            ? state.clubAccounts.find(
              (item) => item.slug === session.club_slug && item.status === "active",
            )
            : null;
          row = session && account ? {
            club_slug: session.club_slug,
            club_name: account.name,
            expires_at: session.expires_at,
          } : null;
        } else if (compactSql.includes("SELECT slug, name, status, key_hash FROM club_accounts")) {
          row = state.clubAccounts.find((item) => item.slug === this.values[0]) || null;
        } else if (compactSql.includes("FROM admin_sessions AS sessions")
          && compactSql.includes("INNER JOIN admin_users")) {
          const session = state.adminSessions.find(
            (item) => item.token_hash === this.values[0] && item.expires_at > this.values[1],
          );
          const user = session
            ? state.adminUsers.find(
              (item) => item.id === session.admin_user_id && item.status === "active",
            )
            : null;
          row = session && user ? {
            id: user.id,
            email: user.email,
            role: user.role,
            csrf_hash: session.csrf_hash,
            expires_at: session.expires_at,
          } : null;
        } else if (compactSql.includes("SELECT id FROM admin_users WHERE email = ?")) {
          row = state.adminUsers.find((item) => item.email === this.values[0]) || null;
        } else if (compactSql.includes("(SELECT COUNT(*) FROM posts")
          && compactSql.includes("AS published_posts")) {
          row = {
            published_posts: state.posts.filter(
              (item) => item.status === "published",
            ).length,
            hidden_posts: state.posts.filter((item) => item.status === "hidden").length,
            pending_reports: state.reports.filter((item) => item.status === "pending").length,
            pending_club_applications: state.clubApplications.filter(
              (item) => item.status === "pending",
            ).length,
            active_clubs: state.clubAccounts.filter((item) => item.status === "active").length,
            restricted_clubs: state.clubAccounts.filter(
              (item) => ["suspended", "revoked"].includes(item.status),
            ).length,
          };
        } else if (compactSql.startsWith("SELECT COUNT(*) AS count FROM posts")) {
          const hasStatus = compactSql.includes("status = ?");
          const hasSearch = compactSql.includes("LOWER(title) LIKE ?");
          let cursor = 0;
          const status = hasStatus ? this.values[cursor++] : null;
          const search = hasSearch
            ? String(this.values[cursor] || "")
              .replace(/^%|%$/g, "")
              .replace(/!([!%_])/g, "$1")
              .toLowerCase()
            : "";
          row = {
            count: state.posts.filter((item) => {
              if (status && item.status !== status) return false;
              if (!search) return true;
              return [
                item.title,
                item.club_name,
                item.id,
                item.area,
              ].filter(Boolean).join(" ").toLowerCase().includes(search);
            }).length,
          };
        } else if (compactSql === "SELECT COUNT(*) AS count FROM reports") {
          row = { count: state.reports.length };
        } else if (compactSql.includes("SELECT COUNT(*) AS count FROM reports WHERE status = ?")) {
          row = { count: state.reports.filter((item) => item.status === this.values[0]).length };
        } else if (compactSql === "SELECT COUNT(*) AS count FROM club_accounts") {
          row = { count: state.clubAccounts.length };
        } else if (compactSql === "SELECT COUNT(*) AS count FROM club_applications") {
          row = { count: state.clubApplications.length };
        } else if (compactSql === "SELECT COUNT(*) AS count FROM audit_logs") {
          row = { count: state.auditLogs.length };
        } else if (compactSql.includes("SELECT id, status, version FROM posts")) {
          row = state.posts.find((item) => item.id === this.values[0]) || null;
        } else if (compactSql.includes("SELECT id, post_id, status, version FROM reports")) {
          row = state.reports.find((item) => item.id === this.values[0]) || null;
        } else if (compactSql.includes("SELECT id, club_name, status, version FROM club_applications")) {
          row = state.clubApplications.find((item) => item.id === this.values[0]) || null;
        } else if (compactSql.includes("SELECT slug FROM club_accounts")) {
          row = state.clubAccounts.find((item) => item.slug === this.values[0]) || null;
        } else if (compactSql.includes("SELECT slug, name, status, version FROM club_accounts")) {
          row = state.clubAccounts.find((item) => item.slug === this.values[0]) || null;
        }
        return column ? row?.[column] ?? null : row;
      },
      async run() {
        let changes = 0;
        if (compactSql.includes("INSERT INTO pending_uploads")) {
          const [
            id, image_key, session_hash, position, created_at, expires_at,
            , activeAfter = created_at, limit = 12,
          ] = this.values;
          if (state.pendingUploads.some(
            (row) => row.session_hash === session_hash && row.position === position,
          )) {
            throw new Error("UNIQUE constraint failed: pending_uploads.session_hash, position");
          }
          const activeCount = state.pendingUploads.filter(
            (row) => row.session_hash === session_hash && row.expires_at > activeAfter,
          ).length;
          if (activeCount < limit) {
            state.pendingUploads.push({
              id, image_key, session_hash, position, created_at, expires_at,
            });
            changes = 1;
          }
        } else if (compactSql.includes("INSERT INTO posts")) {
          const [
            id, category, title, description, area, price, contact_type, contact, image_key,
            event_at, venue, club_slug, club_name, status, owner_token_hash, created_at, expires_at,
          ] = this.values;
          state.posts.push({
            id, category, title, description, area, price, contact_type, contact, image_key,
            event_at, venue, club_slug, club_name, status, owner_token_hash,
            moderation_note: null, moderated_by: null, moderated_at: null,
            version: 1, created_at, expires_at,
          });
          changes = 1;
        } else if (compactSql.includes("INSERT INTO post_images")) {
          const [id, post_id, image_key, position, created_at] = this.values;
          state.postImages.push({ id, post_id, image_key, position, created_at });
          changes = 1;
        } else if (compactSql.includes("INSERT INTO admin_users")) {
          const [id, email, created_at, updated_at] = this.values;
          const existing = state.adminUsers.find((item) => item.email === email);
          if (existing) {
            Object.assign(existing, { id, role: "owner", status: "active", updated_at });
          } else {
            state.adminUsers.push({
              id, email, role: "owner", status: "active", created_at, updated_at, version: 1,
            });
          }
          changes = 1;
        } else if (compactSql.includes("INSERT INTO admin_sessions")) {
          const [token_hash, admin_user_id, csrf_hash, created_at, expires_at] = this.values;
          state.adminSessions.push({
            token_hash, admin_user_id, csrf_hash, created_at, expires_at,
          });
          changes = 1;
        } else if (compactSql.includes("INSERT INTO audit_logs")) {
          const [
            id, actor_user_id, actor_role, action, target_type, target_id,
            metadata_json, created_at,
          ] = this.values;
          state.auditLogs.push({
            id, actor_user_id, actor_role, action, target_type, target_id,
            metadata_json, created_at,
          });
          changes = 1;
        } else if (compactSql.includes("UPDATE posts")
          && compactSql.includes("version = version + 1")) {
          let [status, moderation_note, moderated_by, moderated_at, id, version] = this.values;
          if (compactSql.includes("WHERE id = ? AND status <> 'hidden'")) {
            [moderation_note, moderated_by, moderated_at, id] = this.values;
            status = "hidden";
            version = null;
          }
          const post = state.posts.find(
            (item) => item.id === id
              && (version == null || item.version === version)
              && (!compactSql.includes("status <> 'hidden'") || item.status !== "hidden"),
          );
          if (post) {
            Object.assign(post, {
              status, moderation_note, moderated_by, moderated_at, version: post.version + 1,
            });
            changes = 1;
          }
        } else if (compactSql.includes("INSERT INTO reports")) {
          const [id, post_id, reason, status, created_at] = this.values;
          state.reports.push({
            id, post_id, reason, status, resolution: null, resolved_by: null,
            resolved_at: null, version: 1, created_at,
          });
          changes = 1;
        } else if (compactSql.includes("UPDATE reports")
          && compactSql.includes("version = version + 1")) {
          const [resolution, resolved_by, resolved_at, id, version] = this.values;
          const report = state.reports.find(
            (item) => item.id === id && item.version === version && item.status === "pending",
          );
          if (report) {
            Object.assign(report, {
              status: "resolved", resolution, resolved_by, resolved_at,
              version: report.version + 1,
            });
            changes = 1;
          }
        } else if (compactSql.includes("INSERT INTO club_applications")) {
          const [id, club_name, ukm_email, contact, note, status, created_at] = this.values;
          state.clubApplications.push({
            id, club_name, ukm_email, contact, note, status, club_slug: null,
            decision_note: null, reviewed_by: null, reviewed_at: null,
            version: 1, created_at,
          });
          changes = 1;
        } else if (compactSql.includes("UPDATE club_applications")
          && compactSql.includes("version = version + 1")) {
          const [
            status, club_slug, decision_note, reviewed_by, reviewed_at, id, version,
          ] = this.values;
          const application = state.clubApplications.find(
            (item) => item.id === id && item.version === version && item.status === "pending",
          );
          if (application) {
            Object.assign(application, {
              status, club_slug, decision_note, reviewed_by, reviewed_at,
              version: application.version + 1,
            });
            changes = 1;
          }
        } else if (compactSql.includes("INSERT INTO club_accounts")
          && compactSql.includes("key_hash")
          && compactSql.includes("approved_by")) {
          const [slug, name, key_hash, key_issued_at, approved_by, updated_at] = this.values;
          state.clubAccounts.push({
            slug, name, status: "active", key_hash, key_issued_at, approved_by,
            last_verified_at: 0, updated_at, version: 1,
          });
          changes = 1;
        } else if (compactSql.includes("INSERT INTO club_accounts")
          && compactSql.includes("key_hash")) {
          const [
            slug, name, status, key_hash, key_issued_at, last_verified_at, updated_at,
          ] = this.values;
          if (!state.clubAccounts.some((item) => item.slug === slug)) {
            state.clubAccounts.push({
              slug, name, status, key_hash, key_issued_at, approved_by: null,
              last_verified_at, updated_at, version: 1,
            });
            changes = 1;
          }
        } else if (compactSql.includes("INSERT INTO club_accounts")) {
          const [slug, name, status, last_verified_at, updated_at = last_verified_at] = this.values;
          if (!state.clubAccounts.some((item) => item.slug === slug)) {
            state.clubAccounts.push({
              slug, name, status, key_hash: null, key_issued_at: null, approved_by: null,
              last_verified_at, updated_at, version: 1,
            });
            changes = 1;
          }
        } else if (compactSql.includes("UPDATE club_accounts")
          && compactSql.includes("SET last_verified_at")) {
          const [last_verified_at, updated_at, slug] = this.values;
          const account = state.clubAccounts.find(
            (item) => item.slug === slug && item.status === "active",
          );
          if (account) {
            Object.assign(account, { last_verified_at, updated_at });
            changes = 1;
          }
        } else if (compactSql.includes("UPDATE club_accounts")
          && compactSql.includes("SET status = ?")) {
          const [status, , updated_at, slug, version] = this.values;
          const account = state.clubAccounts.find(
            (item) => item.slug === slug && item.version === version,
          );
          if (account) {
            Object.assign(account, {
              status, updated_at, version: account.version + 1,
              ...(status === "revoked" ? { key_hash: null } : {}),
            });
            changes = 1;
          }
        } else if (compactSql.includes("UPDATE club_accounts")
          && compactSql.includes("SET key_hash = ?")
          && compactSql.includes("last_verified_at")) {
          const [
            key_hash, key_issued_at, last_verified_at, updated_at, slug,
          ] = this.values;
          const account = state.clubAccounts.find(
            (item) => item.slug === slug
              && item.status === "active"
              && item.key_hash == null,
          );
          if (account) {
            Object.assign(account, {
              key_hash, key_issued_at, last_verified_at, updated_at,
            });
            changes = 1;
          }
        } else if (compactSql.includes("UPDATE club_accounts")
          && compactSql.includes("SET key_hash = ?")) {
          const [key_hash, key_issued_at, updated_at, slug, version] = this.values;
          const account = state.clubAccounts.find(
            (item) => item.slug === slug && item.version === version,
          );
          if (account) {
            Object.assign(account, {
              key_hash, key_issued_at, updated_at, version: account.version + 1,
            });
            changes = 1;
          }
        } else if (compactSql.includes("INSERT INTO club_sessions")) {
          const [token_hash, club_slug, club_name, created_at, expires_at] = this.values;
          state.clubSessions.push({
            token_hash, club_slug, club_name, created_at, expires_at,
            revoked_at: null, revoked_reason: null, version: 1,
          });
          changes = 1;
        } else if (compactSql.includes("DELETE FROM admin_sessions WHERE expires_at")) {
          const before = state.adminSessions.length;
          state.adminSessions = state.adminSessions.filter(
            (row) => row.expires_at > this.values[0],
          );
          changes = before - state.adminSessions.length;
        } else if (compactSql.includes("DELETE FROM admin_sessions WHERE token_hash")) {
          const before = state.adminSessions.length;
          state.adminSessions = state.adminSessions.filter(
            (row) => row.token_hash !== this.values[0],
          );
          changes = before - state.adminSessions.length;
        } else if (compactSql.includes("DELETE FROM rate_limits WHERE key_hash")) {
          const before = state.rateLimits.length;
          const checksExpiry = compactSql.includes("expires_at <= ?");
          state.rateLimits = state.rateLimits.filter(
            (row) => row.key_hash !== this.values[0]
              || row.action !== this.values[1]
              || (checksExpiry && row.expires_at > this.values[2]),
          );
          changes = before - state.rateLimits.length;
        } else if (compactSql.includes("DELETE FROM rate_limits WHERE expires_at")) {
          const before = state.rateLimits.length;
          state.rateLimits = state.rateLimits.filter(
            (row) => row.expires_at > this.values[0],
          );
          changes = before - state.rateLimits.length;
        } else if (compactSql.includes("DELETE FROM club_sessions WHERE club_slug")) {
          const before = state.clubSessions.length;
          state.clubSessions = state.clubSessions.filter(
            (row) => row.club_slug !== this.values[0],
          );
          changes = before - state.clubSessions.length;
        } else if (compactSql.includes("DELETE FROM club_sessions WHERE expires_at")) {
          const before = state.clubSessions.length;
          state.clubSessions = state.clubSessions.filter(
            (row) => row.expires_at > this.values[0],
          );
          changes = before - state.clubSessions.length;
        } else if (compactSql.includes("DELETE FROM pending_uploads WHERE session_hash")) {
          const before = state.pendingUploads.length;
          state.pendingUploads = state.pendingUploads.filter(
            (row) => row.session_hash !== this.values[0],
          );
          changes = before - state.pendingUploads.length;
        } else if (compactSql.includes("DELETE FROM pending_uploads WHERE id")) {
          const before = state.pendingUploads.length;
          state.pendingUploads = state.pendingUploads.filter((row) => row.id !== this.values[0]);
          changes = before - state.pendingUploads.length;
        } else if (compactSql.includes("DELETE FROM post_images WHERE post_id")) {
          const before = state.postImages.length;
          state.postImages = state.postImages.filter((row) => row.post_id !== this.values[0]);
          changes = before - state.postImages.length;
        } else if (compactSql.includes("DELETE FROM posts WHERE id")) {
          const before = state.posts.length;
          state.posts = state.posts.filter((row) => row.id !== this.values[0]);
          changes = before - state.posts.length;
        }
        return { success: true, meta: { changes } };
      },
    };
  }

  return {
    state,
    env: {
      DB: {
        prepare,
        async batch(statements) {
          const results = [];
          for (const statement of statements) results.push(await statement.run());
          return results;
        },
      },
      UPLOADS: {
        async put(key, bytes, metadata) {
          state.objects.set(key, { bytes, metadata });
        },
        async delete(keys) {
          for (const key of Array.isArray(keys) ? keys : [keys]) state.objects.delete(key);
        },
        async get(key) {
          const object = state.objects.get(key);
          if (!object) return null;
          return {
            body: object.bytes,
            httpEtag: '"test-etag"',
            writeHttpMetadata(headers) {
              const contentType = object.metadata?.httpMetadata?.contentType;
              if (contentType) headers.set("content-type", contentType);
            },
          };
        },
      },
    },
  };
}

function postForm(area = "UKM Main Campus") {
  const form = new FormData();
  form.set("category", "marketplace");
  form.set("title", "Desk lamp for sale");
  form.set("description", "Used desk lamp in good working condition for a UKM student.");
  form.set("area", area);
  form.set("price", "RM 20");
  form.set("contactType", "WhatsApp");
  form.set("contact", "+60 12-345 6789");
  return form;
}

async function hash(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function responseCookies(response) {
  const values = typeof response.headers.getSetCookie === "function"
    ? response.headers.getSetCookie()
    : [response.headers.get("set-cookie") || ""];
  return values.map((value) => value.split(";")[0]).filter(Boolean).join("; ");
}

function cookieValue(cookies, name) {
  const match = cookies.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : "";
}

async function loginAdmin(env) {
  const response = await worker.fetch(new Request("https://example.test/api/admin/session", {
    method: "POST",
    headers: {
      origin: "https://example.test",
      "content-type": "application/json",
    },
    body: JSON.stringify({ email: "owner@example.test", accessKey: "correct-admin-key" }),
  }), {
    ...env,
    KAWAN_ADMIN_EMAIL: "owner@example.test",
    KAWAN_ADMIN_ACCESS_KEY: "correct-admin-key",
  });
  const cookies = responseCookies(response);
  return {
    response,
    cookies,
    csrf: cookieValue(cookies, "kawan_admin_csrf"),
  };
}

function adminWrite(path, { method = "POST", body, cookies, csrf }) {
  return new Request(`https://example.test${path}`, {
    method,
    headers: {
      origin: "https://example.test",
      cookie: cookies,
      "content-type": "application/json",
      "x-kawan-csrf": csrf,
    },
    body: JSON.stringify(body),
  });
}

test("serves a bundled asset without rewriting it", async () => {
  const request = new Request("https://example.test/assets/app.js");
  const response = await worker.fetch(request, { ASSETS: createAssets(files) });

  assert.equal(response.status, 200);
  assert.equal(await response.text(), "console.log('ready')");
});

test("falls back to the app shell for browser routes", async () => {
  const request = new Request("https://example.test/my-posts", {
    headers: { accept: "text/html" },
  });
  const response = await worker.fetch(request, { ASSETS: createAssets(files) });

  assert.equal(response.status, 200);
  assert.equal(await response.text(), "<main>Kawan Campus</main>");
  assert.equal(response.headers.get("x-frame-options"), "DENY");
  assert.match(response.headers.get("content-security-policy") || "", /frame-ancestors 'none'/);
});

test("keeps missing asset requests as 404 responses", async () => {
  const request = new Request("https://example.test/assets/missing.png");
  const response = await worker.fetch(request, { ASSETS: createAssets(files) });

  assert.equal(response.status, 404);
});

test("returns a service error when the asset binding is missing", async () => {
  const request = new Request("https://example.test/");
  const response = await worker.fetch(request, {});

  assert.equal(response.status, 503);
});

test("reports API binding readiness without exposing secrets", async () => {
  const request = new Request("https://example.test/api/health");
  const response = await worker.fetch(request, { DB: {}, UPLOADS: {} });
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.service, "kawan-campus-ukm");
  assert.deepEqual(payload.storage, { d1: true, r2: true });
});

test("returns an empty feed when D1 is not connected", async () => {
  const request = new Request("https://example.test/api/posts");
  const response = await worker.fetch(request, {});
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(payload.posts, []);
  assert.equal(payload.storageReady, false);
});

test("blocks event publishing without a verified club session", async () => {
  const form = new FormData();
  form.set("category", "events");
  form.set("title", "UKM test event");
  form.set("description", "A sufficiently detailed event description.");
  form.set("area", "UKM Main Campus");
  form.set("contactType", "WhatsApp");
  form.set("contact", "+60 12-345 6789");
  form.set("eventAt", new Date(Date.now() + 86_400_000).toISOString());
  form.set("venue", "Pusanika");

  const request = new Request("https://example.test/api/posts", {
    method: "POST",
    headers: { origin: "https://example.test" },
    body: form,
  });
  const response = await worker.fetch(request, { DB: {} });
  const payload = await response.json();

  assert.equal(response.status, 403);
  assert.equal(payload.error.code, "club_required");
});

test("rejects event publishing when the browser origin cannot be verified", async () => {
  const form = new FormData();
  form.set("category", "events");
  form.set("title", "UKM test event");
  form.set("description", "A sufficiently detailed event description.");
  form.set("area", "UKM Main Campus");
  form.set("contactType", "WhatsApp");
  form.set("contact", "+60 12-345 6789");
  form.set("eventAt", new Date(Date.now() + 86_400_000).toISOString());

  const response = await worker.fetch(new Request("https://example.test/api/posts", {
    method: "POST",
    body: form,
  }), { DB: {} });

  assert.equal(response.status, 403);
  assert.equal((await response.json()).error.code, "invalid_origin");
});

test("rejects exact rental unit numbers before publishing", async () => {
  const form = new FormData();
  form.set("category", "housing");
  form.set("title", "Room available near UKM");
  form.set("description", "Looking for one UKM student housemate near campus.");
  form.set("area", "Evo Soho, Unit 12-3");
  form.set("contactType", "WhatsApp");
  form.set("contact", "+60 12-345 6789");

  const request = new Request("https://example.test/api/posts", {
    method: "POST",
    body: form,
  });
  const response = await worker.fetch(request, { DB: {} });
  const payload = await response.json();

  assert.equal(response.status, 400);
  assert.match(payload.error.message, /门牌号|房号/);
});

test("rejects a Chinese room number entered in the rental address", async () => {
  const form = new FormData();
  form.set("category", "housing");
  form.set("title", "UKM 附近单间找室友");
  form.set("description", "房间采光良好，希望寻找一位爱干净的 UKM 学生室友。");
  form.set("area", "Evo Soho, 1203室");
  form.set("contactType", "WeChat");
  form.set("contact", "kawan-demo");

  const response = await worker.fetch(new Request("https://example.test/api/posts", {
    method: "POST",
    body: form,
  }), { DB: {} });
  const payload = await response.json();

  assert.equal(response.status, 400);
  assert.match(payload.error.message, /门牌号|房号/);
});

test("accepts a free-form address and preserves multiple sequential images", async () => {
  const { env, state } = createStorage();
  const uploadSession = crypto.randomUUID();

  for (const [position, name] of ["front.jpg", "side.jpg"].entries()) {
    const upload = new FormData();
    upload.set("uploadSession", uploadSession);
    upload.set("position", String(position));
    upload.set("image", new Blob([`image-${position}`], { type: "image/jpeg" }), name);
    const uploadResponse = await worker.fetch(new Request("https://example.test/api/uploads", {
      method: "POST",
      body: upload,
    }), env);
    assert.equal(uploadResponse.status, 201);
  }

  const form = postForm("Evo Soho, Jalan Medan Bangi, Bandar Baru Bangi");
  form.set("uploadSession", uploadSession);
  const createResponse = await worker.fetch(new Request("https://example.test/api/posts", {
    method: "POST",
    body: form,
  }), env);
  const created = await createResponse.json();

  assert.equal(createResponse.status, 201);
  assert.equal(created.post.area, "Evo Soho, Jalan Medan Bangi, Bandar Baru Bangi");
  assert.equal(created.post.imageUrls.length, 2);
  assert.equal(created.post.retention, "permanent");
  assert.equal(created.post.expiresAt, null);
  assert.equal(state.posts[0].expires_at, PERMANENT_POST_EXPIRES_AT);
  assert.ok(created.post.imageUrls.every((url) => url.includes("posts%2Flive%2F")));
  assert.equal(state.postImages.length, 2);
  assert.equal(state.pendingUploads.length, 0);
  assert.equal(state.objects.size, 2);
  assert.ok([...state.objects.keys()].every((key) => key.startsWith("posts/live/")));

  const feedResponse = await worker.fetch(new Request("https://example.test/api/posts"), env);
  const feed = await feedResponse.json();
  assert.equal(feed.posts[0].imageUrls.length, 2);
  assert.deepEqual(feed.posts[0].imageUrls, created.post.imageUrls);

  const deleteResponse = await worker.fetch(new Request(
    `https://example.test/api/posts/${encodeURIComponent(created.post.id)}`,
    {
      method: "DELETE",
      headers: { "x-kawan-delete-token": created.ownerToken },
    },
  ), env);
  assert.equal(deleteResponse.status, 200);
  assert.equal(state.posts.length, 0);
  assert.equal(state.postImages.length, 0);
  assert.equal(state.objects.size, 0);
});

test("requires every post to provide its own location", async () => {
  const form = postForm("");
  const response = await worker.fetch(new Request("https://example.test/api/posts", {
    method: "POST",
    body: form,
  }), { DB: {} });
  const payload = await response.json();

  assert.equal(response.status, 400);
  assert.match(payload.error.message, /地址|地点/);
});

test("rejects unknown club publishing keys", async () => {
  const request = new Request("https://example.test/api/clubs/verify", {
    method: "POST",
    headers: { origin: "https://example.test", "content-type": "application/json" },
    body: JSON.stringify({ clubSlug: "unknown-club", accessKey: "incorrect-key" }),
  });
  const response = await worker.fetch(request, { DB: {}, UKM_CLUB_KEYS: "{}" });
  const payload = await response.json();

  assert.equal(response.status, 401);
  assert.equal(payload.error.code, "invalid_club_key");
});

test("rejects club verification without a same-origin browser request", async () => {
  const response = await worker.fetch(new Request("https://example.test/api/clubs/verify", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ clubSlug: "ukm-club", accessKey: "candidate-key" }),
  }), { DB: {} });

  assert.equal(response.status, 403);
  assert.equal((await response.json()).error.code, "invalid_origin");
});

test("migrates a valid legacy club key into D1 without overriding account status", async () => {
  const accessKey = "legacy-club-key";
  const keyHash = await hash(accessKey);
  const { env, state } = createStorage();
  const legacyEnv = {
    ...env,
    UKM_CLUB_KEYS: JSON.stringify({
      "ukm-legacy": { name: "UKM Legacy Club", keyHash },
    }),
  };
  const firstLogin = await worker.fetch(new Request("https://example.test/api/clubs/verify", {
    method: "POST",
    headers: { origin: "https://example.test", "content-type": "application/json" },
    body: JSON.stringify({ clubSlug: "ukm-legacy", accessKey }),
  }), legacyEnv);
  assert.equal(firstLogin.status, 200);
  assert.equal(state.clubAccounts[0].key_hash, keyHash);

  const secondLogin = await worker.fetch(new Request("https://example.test/api/clubs/verify", {
    method: "POST",
    headers: { origin: "https://example.test", "content-type": "application/json" },
    body: JSON.stringify({ clubSlug: "ukm-legacy", accessKey }),
  }), { ...env, UKM_CLUB_KEYS: "{}" });
  assert.equal(secondLogin.status, 200);
  assert.equal(state.clubAccounts[0].status, "active");
});

test("rejects unauthenticated admin access and enforces login origin plus CSRF", async () => {
  const { env, state } = createStorage({
    posts: [{
      id: "post_admin_csrf",
      category: "marketplace",
      title: "Study desk",
      description: "A clean study desk available near the UKM campus.",
      area: "Bandar Baru Bangi",
      price: "RM 50",
      contact_type: "WhatsApp",
      contact: "+60 12-345 6789",
      image_key: null,
      event_at: null,
      venue: null,
      club_slug: null,
      club_name: null,
      status: "published",
      owner_token_hash: "not-returned",
      moderation_note: null,
      moderated_by: null,
      moderated_at: null,
      version: 1,
      created_at: Date.now(),
      expires_at: Date.now() + 86_400_000,
    }],
  });
  const configuredEnv = {
    ...env,
    KAWAN_ADMIN_EMAIL: "owner@example.test",
    KAWAN_ADMIN_ACCESS_KEY: "correct-admin-key",
  };

  const anonymous = await worker.fetch(
    new Request("https://example.test/api/admin/overview"),
    configuredEnv,
  );
  assert.equal(anonymous.status, 401);

  const missingOrigin = await worker.fetch(new Request("https://example.test/api/admin/session", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "owner@example.test", accessKey: "correct-admin-key" }),
  }), configuredEnv);
  assert.equal(missingOrigin.status, 403);

  const login = await loginAdmin(env);
  assert.equal(login.response.status, 200);
  assert.ok(login.cookies.includes("kawan_admin_session="));
  assert.ok(login.csrf);
  const rawSetCookies = login.response.headers.getSetCookie();
  assert.match(rawSetCookies.find((value) => value.startsWith("kawan_admin_session=")), /HttpOnly/);
  assert.match(rawSetCookies.find((value) => value.startsWith("kawan_admin_session=")), /SameSite=Strict/);
  assert.doesNotMatch(
    rawSetCookies.find((value) => value.startsWith("kawan_admin_csrf=")),
    /HttpOnly/,
  );
  assert.equal(state.adminSessions.length, 1);
  assert.equal(state.rateLimits.some((row) => row.action === "admin_login"), false);
  assert.equal("token" in state.adminSessions[0], false);
  assert.equal("csrf" in state.adminSessions[0], false);

  const withoutCsrf = await worker.fetch(new Request(
    "https://example.test/api/admin/posts/post_admin_csrf/status",
    {
      method: "PATCH",
      headers: {
        origin: "https://example.test",
        cookie: login.cookies,
        "content-type": "application/json",
      },
      body: JSON.stringify({ status: "hidden", version: 1 }),
    },
  ), configuredEnv);
  assert.equal(withoutCsrf.status, 403);
  assert.equal((await withoutCsrf.json()).error.code, "invalid_csrf");

  const logout = await worker.fetch(adminWrite(
    "/api/admin/session",
    {
      method: "DELETE",
      body: {},
      cookies: login.cookies,
      csrf: login.csrf,
    },
  ), configuredEnv);
  assert.equal(logout.status, 200);
  assert.equal(state.adminSessions.length, 0);
  const afterLogout = await worker.fetch(new Request(
    "https://example.test/api/admin/session",
    { headers: { cookie: login.cookies } },
  ), configuredEnv);
  assert.equal(afterLogout.status, 401);
});

test("admin can hide and restore a post immediately with optimistic locking and audit", async () => {
  const now = Date.now();
  const { env, state } = createStorage({
    posts: [{
      id: "post_moderation",
      category: "housing",
      title: "Room near UKM",
      description: "A furnished room close to UKM is available next month.",
      area: "Bandar Baru Bangi",
      price: "RM 650",
      contact_type: "WhatsApp",
      contact: "+60 12-345 6789",
      image_key: null,
      event_at: null,
      venue: null,
      club_slug: null,
      club_name: null,
      status: "published",
      owner_token_hash: "private-owner-hash",
      moderation_note: null,
      moderated_by: null,
      moderated_at: null,
      version: 1,
      created_at: now,
      expires_at: now - 1,
    }],
  });
  const configuredEnv = {
    ...env,
    KAWAN_ADMIN_EMAIL: "owner@example.test",
    KAWAN_ADMIN_ACCESS_KEY: "correct-admin-key",
  };
  const login = await loginAdmin(env);

  const before = await (await worker.fetch(
    new Request("https://example.test/api/posts"),
    configuredEnv,
  )).json();
  assert.equal(before.posts.length, 1);
  assert.equal(before.posts[0].retention, "permanent");

  const overviewResponse = await worker.fetch(
    new Request("https://example.test/api/admin/overview", {
      headers: { cookie: login.cookies },
    }),
    configuredEnv,
  );
  const overview = await overviewResponse.json();
  assert.equal(overviewResponse.status, 200);
  assert.equal(overview.metrics.publishedPosts, 1);
  assert.equal(overview.rules.postRetention, "permanent");

  const hiddenResponse = await worker.fetch(adminWrite(
    "/api/admin/posts/post_moderation/status",
    {
      method: "PATCH",
      body: {
        status: "hidden",
        version: 1,
        reason: "Contact user@example.com +60 12-345 6789 kawan_club_1234567890123456",
      },
      cookies: login.cookies,
      csrf: login.csrf,
    },
  ), configuredEnv);
  assert.equal(hiddenResponse.status, 200);
  assert.equal((await hiddenResponse.json()).post.version, 2);

  const hiddenFeed = await (await worker.fetch(
    new Request("https://example.test/api/posts"),
    configuredEnv,
  )).json();
  assert.deepEqual(hiddenFeed.posts, []);

  const staleResponse = await worker.fetch(adminWrite(
    "/api/admin/posts/post_moderation/status",
    {
      method: "PATCH",
      body: { status: "published", version: 1 },
      cookies: login.cookies,
      csrf: login.csrf,
    },
  ), configuredEnv);
  assert.equal(staleResponse.status, 409);
  assert.equal((await staleResponse.json()).error.code, "version_conflict");

  const restoredResponse = await worker.fetch(adminWrite(
    "/api/admin/posts/post_moderation/status",
    {
      method: "PATCH",
      body: { status: "published", version: 2 },
      cookies: login.cookies,
      csrf: login.csrf,
    },
  ), configuredEnv);
  assert.equal(restoredResponse.status, 200);
  const restoredFeed = await (await worker.fetch(
    new Request("https://example.test/api/posts"),
    configuredEnv,
  )).json();
  assert.equal(restoredFeed.posts.length, 1);
  assert.equal(restoredFeed.posts[0].id, "post_moderation");

  const auditResponse = await worker.fetch(new Request(
    "https://example.test/api/admin/audit-logs",
    { headers: { cookie: login.cookies } },
  ), configuredEnv);
  const auditPayload = await auditResponse.json();
  assert.equal(auditResponse.status, 200);
  assert.equal(
    auditPayload.auditLogs.filter((entry) => entry.action === "post.status_changed").length,
    2,
  );
  const hiddenAudit = auditPayload.auditLogs.find(
    (entry) => entry.metadata?.toStatus === "hidden",
  );
  assert.match(hiddenAudit.metadata.reason, /\[redacted-email\]/);
  assert.match(hiddenAudit.metadata.reason, /\[redacted-phone\]/);
  assert.match(hiddenAudit.metadata.reason, /\[redacted-secret\]/);
  assert.equal(hiddenAudit.actorEmail, "owner@example.test");
  assert.doesNotMatch(
    JSON.stringify(hiddenAudit),
    /user@example\.com|\+60 12-345 6789|kawan_club_1234567890123456/,
  );
  assert.doesNotMatch(JSON.stringify(auditPayload), /owner_token_hash|csrf_hash|token_hash/);
  assert.equal(state.posts[0].version, 3);
});

test("resolving a report can atomically hide its post and record an audit event", async () => {
  const now = Date.now();
  const { env, state } = createStorage({
    posts: [{
      id: "post_reported",
      category: "marketplace",
      title: "Reported listing",
      description: "A listing that requires a moderator decision.",
      area: "UKM Main Campus",
      price: "",
      contact_type: "Telegram",
      contact: "private-contact",
      image_key: null,
      event_at: null,
      venue: null,
      club_slug: null,
      club_name: null,
      status: "published",
      owner_token_hash: "private-owner-hash",
      moderation_note: null,
      moderated_by: null,
      moderated_at: null,
      version: 1,
      created_at: now,
      expires_at: now + 86_400_000,
    }],
    reports: [{
      id: "report_abuse",
      post_id: "post_reported",
      reason: "Potential scam",
      status: "pending",
      resolution: null,
      resolved_by: null,
      resolved_at: null,
      version: 1,
      created_at: now,
    }],
  });
  const configuredEnv = {
    ...env,
    KAWAN_ADMIN_EMAIL: "owner@example.test",
    KAWAN_ADMIN_ACCESS_KEY: "correct-admin-key",
  };
  const login = await loginAdmin(env);
  const response = await worker.fetch(adminWrite(
    "/api/admin/reports/report_abuse/resolve",
    {
      body: { decision: "hide_post", version: 1, note: "Moderator reviewed report" },
      cookies: login.cookies,
      csrf: login.csrf,
    },
  ), configuredEnv);
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.report.resolution, "hide_post");
  assert.equal(state.reports[0].status, "resolved");
  assert.equal(state.posts[0].status, "hidden");
  assert.ok(state.auditLogs.some((entry) => entry.action === "report.resolved"));
  assert.doesNotMatch(JSON.stringify(state.auditLogs), /private-contact|private-owner-hash/);

  const feed = await (await worker.fetch(
    new Request("https://example.test/api/posts"),
    configuredEnv,
  )).json();
  assert.deepEqual(feed.posts, []);
});

test("club approval returns its key once and suspension invalidates the old session", async () => {
  const now = Date.now();
  const { env, state } = createStorage({
    clubApplications: [{
      id: "application_robotics",
      club_name: "UKM Robotics Club",
      ukm_email: "robotics@ukm.edu.my",
      contact: "Committee contact",
      note: "Official student club",
      status: "pending",
      club_slug: null,
      decision_note: null,
      reviewed_by: null,
      reviewed_at: null,
      version: 1,
      created_at: now,
    }],
  });
  const configuredEnv = {
    ...env,
    KAWAN_ADMIN_EMAIL: "owner@example.test",
    KAWAN_ADMIN_ACCESS_KEY: "correct-admin-key",
  };
  const login = await loginAdmin(env);

  const approvalResponse = await worker.fetch(adminWrite(
    "/api/admin/club-applications/application_robotics/decision",
    {
      body: { decision: "approve", version: 1, clubSlug: "ukm-robotics" },
      cookies: login.cookies,
      csrf: login.csrf,
    },
  ), configuredEnv);
  const approved = await approvalResponse.json();
  assert.equal(approvalResponse.status, 200);
  assert.match(approved.accessKey, /^kawan_club_[a-f0-9]{64}$/);
  assert.equal(approved.club.slug, "ukm-robotics");
  assert.equal("keyHash" in approved.club, false);
  assert.equal(state.clubAccounts[0].key_hash, await hash(approved.accessKey));

  const repeatedDecision = await worker.fetch(adminWrite(
    "/api/admin/club-applications/application_robotics/decision",
    {
      body: { decision: "approve", version: 1, clubSlug: "ukm-robotics" },
      cookies: login.cookies,
      csrf: login.csrf,
    },
  ), configuredEnv);
  const repeatedPayload = await repeatedDecision.json();
  assert.equal(repeatedDecision.status, 409);
  assert.equal("accessKey" in repeatedPayload, false);

  const verifyResponse = await worker.fetch(new Request("https://example.test/api/clubs/verify", {
    method: "POST",
    headers: { origin: "https://example.test", "content-type": "application/json" },
    body: JSON.stringify({ clubSlug: "ukm-robotics", accessKey: approved.accessKey }),
  }), configuredEnv);
  assert.equal(verifyResponse.status, 200);
  const clubCookies = responseCookies(verifyResponse);
  const activeSession = await (await worker.fetch(new Request(
    "https://example.test/api/clubs/session",
    { headers: { cookie: clubCookies } },
  ), configuredEnv)).json();
  assert.equal(activeSession.club.slug, "ukm-robotics");
  assert.equal(state.clubSessions.length, 1);

  const suspension = await worker.fetch(adminWrite(
    "/api/admin/clubs/ukm-robotics/status",
    {
      method: "PATCH",
      body: { status: "suspended", version: 1 },
      cookies: login.cookies,
      csrf: login.csrf,
    },
  ), configuredEnv);
  assert.equal(suspension.status, 200);
  assert.equal(state.clubSessions.length, 0);

  const expiredSession = await (await worker.fetch(new Request(
    "https://example.test/api/clubs/session",
    { headers: { cookie: clubCookies } },
  ), configuredEnv)).json();
  assert.equal(expiredSession.club, null);

  const suspendedLogin = await worker.fetch(new Request("https://example.test/api/clubs/verify", {
    method: "POST",
    headers: { origin: "https://example.test", "content-type": "application/json" },
    body: JSON.stringify({ clubSlug: "ukm-robotics", accessKey: approved.accessKey }),
  }), configuredEnv);
  assert.equal(suspendedLogin.status, 403);
  assert.equal((await suspendedLogin.json()).error.code, "club_inactive");
  assert.ok(state.auditLogs.some((entry) => entry.action === "club_application.approved"));
  assert.ok(state.auditLogs.some((entry) => entry.action === "club.status_changed"));
  assert.doesNotMatch(JSON.stringify(state.auditLogs), new RegExp(approved.accessKey));
});

test("limits each upload session and post to twelve images before writing more R2 objects", async () => {
  const { env, state } = createStorage();
  const uploadSession = crypto.randomUUID();

  for (let position = 0; position < 12; position += 1) {
    const upload = new FormData();
    upload.set("uploadSession", uploadSession);
    upload.set("position", String(position));
    upload.set(
      "image",
      new Blob([`image-${position}`], { type: "image/jpeg" }),
      `${position}.jpg`,
    );
    const response = await worker.fetch(new Request("https://example.test/api/uploads", {
      method: "POST",
      body: upload,
    }), env);
    assert.equal(response.status, 201);
  }

  const thirteenth = new FormData();
  thirteenth.set("uploadSession", uploadSession);
  thirteenth.set("position", "12");
  thirteenth.set("image", new Blob(["image-12"], { type: "image/jpeg" }), "12.jpg");
  const rejectedUpload = await worker.fetch(new Request("https://example.test/api/uploads", {
    method: "POST",
    body: thirteenth,
  }), env);
  assert.equal(rejectedUpload.status, 409);
  assert.equal((await rejectedUpload.json()).error.code, "image_limit_reached");
  assert.equal(state.pendingUploads.length, 12);
  assert.equal(state.objects.size, 12);

  const overflowSession = crypto.randomUUID();
  const overflowHash = await hash(overflowSession);
  const overflowRows = Array.from({ length: 13 }, (_, position) => ({
    id: `overflow-${position}`,
    image_key: `posts/pending/overflow-${position}.jpg`,
    session_hash: overflowHash,
    position,
    created_at: Date.now(),
    expires_at: Date.now() + 86_400_000,
  }));
  const overflowStorage = createStorage({ pendingUploads: overflowRows });
  const form = postForm();
  form.set("uploadSession", overflowSession);
  const rejectedPost = await worker.fetch(new Request("https://example.test/api/posts", {
    method: "POST",
    body: form,
  }), overflowStorage.env);
  assert.equal(rejectedPost.status, 409);
  assert.equal((await rejectedPost.json()).error.code, "image_limit_reached");
  assert.equal(overflowStorage.state.posts.length, 0);

  const concurrentStorage = createStorage();
  const concurrentSession = crypto.randomUUID();
  const uploadAtSamePosition = (name) => {
    const upload = new FormData();
    upload.set("uploadSession", concurrentSession);
    upload.set("position", "0");
    upload.set("image", new Blob([name], { type: "image/jpeg" }), `${name}.jpg`);
    return worker.fetch(new Request("https://example.test/api/uploads", {
      method: "POST",
      body: upload,
    }), concurrentStorage.env);
  };
  const concurrentResponses = await Promise.all([
    uploadAtSamePosition("first"),
    uploadAtSamePosition("second"),
  ]);
  assert.deepEqual(
    concurrentResponses.map((response) => response.status).sort(),
    [201, 409],
  );
  assert.equal(concurrentStorage.state.pendingUploads.length, 1);
  assert.equal(concurrentStorage.state.objects.size, 1);
});

test("rejects an oversized streamed upload even without a Content-Length header", async () => {
  const oversizedBody = new Uint8Array((6 * 1024 * 1024) + 1);
  const request = new Request("https://example.test/api/uploads", {
    method: "POST",
    headers: { "content-type": "multipart/form-data; boundary=kawan-test" },
    body: oversizedBody,
  });
  assert.equal(request.headers.has("content-length"), false);

  const response = await worker.fetch(request, { DB: {}, UPLOADS: {} });
  assert.equal(response.status, 413);
  assert.equal((await response.json()).error.code, "payload_too_large");
});

test("bounds every JSON request stream and returns one structured parse error shape", async () => {
  const oversizedBody = new Uint8Array((64 * 1024) + 1);
  const oversizedRequest = new Request("https://example.test/api/presence", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: oversizedBody,
  });
  assert.equal(oversizedRequest.headers.has("content-length"), false);

  const oversizedResponse = await worker.fetch(oversizedRequest, { DB: {} });
  const oversizedPayload = await oversizedResponse.json();
  assert.equal(oversizedResponse.status, 413);
  assert.deepEqual(Object.keys(oversizedPayload), ["ok", "error"]);
  assert.equal(oversizedPayload.ok, false);
  assert.deepEqual(Object.keys(oversizedPayload.error), ["code", "message"]);
  assert.equal(oversizedPayload.error.code, "payload_too_large");

  const malformedResponse = await worker.fetch(new Request(
    "https://example.test/api/presence",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{",
    },
  ), { DB: {} });
  const malformedPayload = await malformedResponse.json();
  assert.equal(malformedResponse.status, 400);
  assert.deepEqual(Object.keys(malformedPayload), ["ok", "error"]);
  assert.equal(malformedPayload.ok, false);
  assert.deepEqual(Object.keys(malformedPayload.error), ["code", "message"]);
  assert.equal(malformedPayload.error.code, "invalid_json");
});

test("accepts reports for every published post regardless of age and deduplicates each IP plus post for 24 hours", async () => {
  const now = Date.now();
  const basePost = {
    category: "marketplace",
    title: "Current UKM listing",
    description: "A current listing that can be reported by campus users.",
    area: "UKM Main Campus",
    price: "RM 10",
    contact_type: "Telegram",
    contact: "campus-contact",
    image_key: null,
    event_at: null,
    venue: null,
    club_slug: null,
    club_name: null,
    owner_token_hash: "private-owner-hash",
    moderation_note: null,
    moderated_by: null,
    moderated_at: null,
    version: 1,
    created_at: now,
  };
  const { env, state } = createStorage({
    posts: [
      {
        ...basePost,
        id: "post_live",
        status: "published",
        expires_at: now + 86_400_000,
      },
      {
        ...basePost,
        id: "post_hidden",
        status: "hidden",
        expires_at: now + 86_400_000,
      },
      {
        ...basePost,
        id: "post_expired",
        status: "published",
        expires_at: now - 1,
      },
    ],
  });
  const salt = "test-report-dedupe-salt";
  const firstIpHash = await hash(`${salt}:203.0.113.10`);
  state.rateLimits.push({
    key_hash: await hash(`${firstIpHash}:post_live`),
    action: "report_post_duplicate",
    window_start: 0,
    count: 1,
    expires_at: now - 1,
  });
  const report = (postId, ip) => worker.fetch(new Request(
    "https://example.test/api/reports",
    {
      method: "POST",
      headers: {
        "cf-connecting-ip": ip,
        "content-type": "application/json",
      },
      body: JSON.stringify({ postId, reason: "Suspected misleading listing" }),
    },
  ), { ...env, KAWAN_RATE_LIMIT_SALT: salt });

  const first = await report("post_live", "203.0.113.10");
  assert.equal(first.status, 201);

  const duplicate = await report("post_live", "203.0.113.10");
  assert.equal(duplicate.status, 409);
  assert.equal((await duplicate.json()).error.code, "duplicate_report");

  const otherReporter = await report("post_live", "203.0.113.11");
  assert.equal(otherReporter.status, 201);

  const hidden = await report("post_hidden", "203.0.113.12");
  assert.equal(hidden.status, 404);
  assert.equal((await hidden.json()).error.code, "post_not_reportable");

  const historic = await report("post_expired", "203.0.113.13");
  assert.equal(historic.status, 201);

  assert.equal(state.reports.length, 3);
  const duplicateWindows = state.rateLimits.filter(
    (item) => item.action === "report_post_duplicate",
  );
  assert.equal(duplicateWindows.length, 3);
  assert.ok(duplicateWindows.every((item) => item.expires_at > now));
  assert.ok(duplicateWindows.every((item) => /^[a-f0-9]{64}$/.test(item.key_hash)));
  assert.doesNotMatch(JSON.stringify(duplicateWindows), /203\.0\.113|post_live/);
});

test("rate limits failed admin logins by hashed IP and returns Retry-After", async () => {
  const { env, state } = createStorage();
  const configuredEnv = {
    ...env,
    KAWAN_ADMIN_EMAIL: "owner@example.test",
    KAWAN_ADMIN_ACCESS_KEY: "correct-admin-key",
    KAWAN_RATE_LIMIT_SALT: "test-only-rate-limit-salt",
  };
  for (let attempt = 1; attempt <= 6; attempt += 1) {
    const response = await worker.fetch(new Request(
      "https://example.test/api/admin/session",
      {
        method: "POST",
        headers: {
          origin: "https://example.test",
          "cf-connecting-ip": "203.0.113.42",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          email: "owner@example.test",
          accessKey: "wrong-admin-key",
        }),
      },
    ), configuredEnv);
    assert.equal(response.status, attempt <= 5 ? 401 : 429);
    if (attempt === 6) {
      assert.equal((await response.json()).error.code, "rate_limited");
      assert.ok(Number(response.headers.get("retry-after")) > 0);
    }
  }
  assert.equal(state.rateLimits.length, 1);
  assert.equal(state.rateLimits[0].action, "admin_login");
  assert.match(state.rateLimits[0].key_hash, /^[a-f0-9]{64}$/);
  assert.doesNotMatch(JSON.stringify(state.rateLimits), /203\.0\.113\.42/);
});

test("hidden post media becomes private while authenticated moderators retain preview access", async () => {
  const now = Date.now();
  const imageKey = "posts/pending/moderated-image.jpg";
  const { env, state } = createStorage({
    posts: [{
      id: "post_with_media",
      category: "marketplace",
      title: "Listing with image",
      description: "A listing image that must disappear after moderation.",
      area: "UKM Main Campus",
      price: "RM 10",
      contact_type: "Telegram",
      contact: "contact-handle",
      image_key: imageKey,
      event_at: null,
      venue: null,
      club_slug: null,
      club_name: null,
      status: "published",
      owner_token_hash: "owner-hash",
      moderation_note: null,
      moderated_by: null,
      moderated_at: null,
      version: 1,
      created_at: now,
      expires_at: now - 1,
    }],
    postImages: [{
      id: "image_row",
      post_id: "post_with_media",
      image_key: imageKey,
      position: 0,
      created_at: now,
    }],
  });
  state.objects.set(imageKey, {
    bytes: new TextEncoder().encode("image-bytes"),
    metadata: { httpMetadata: { contentType: "image/jpeg" } },
  });
  const configuredEnv = {
    ...env,
    KAWAN_ADMIN_EMAIL: "owner@example.test",
    KAWAN_ADMIN_ACCESS_KEY: "correct-admin-key",
  };
  const publicBefore = await worker.fetch(new Request(
    `https://example.test/media/${encodeURIComponent(imageKey)}`,
  ), configuredEnv);
  assert.equal(publicBefore.status, 200);
  assert.equal(publicBefore.headers.get("cache-control"), "private, no-store");

  const login = await loginAdmin(env);
  const hide = await worker.fetch(adminWrite(
    "/api/admin/posts/post_with_media/status",
    {
      method: "PATCH",
      body: { status: "hidden", version: 1, reason: "Policy review" },
      cookies: login.cookies,
      csrf: login.csrf,
    },
  ), configuredEnv);
  assert.equal(hide.status, 200);

  const publicAfter = await worker.fetch(new Request(
    `https://example.test/media/${encodeURIComponent(imageKey)}`,
  ), configuredEnv);
  assert.equal(publicAfter.status, 404);

  const adminPreview = await worker.fetch(new Request(
    `https://example.test/api/admin/media?key=${encodeURIComponent(imageKey)}`,
    { headers: { cookie: login.cookies } },
  ), configuredEnv);
  assert.equal(adminPreview.status, 200);
  assert.equal(adminPreview.headers.get("cache-control"), "private, no-store");
});

test("admin report pagination returns accurate totals and a controlled moderation preview", async () => {
  const now = Date.now();
  const posts = ["one", "two", "three"].map((suffix, index) => ({
    id: `post_${suffix}`,
    category: "marketplace",
    title: `Listing ${suffix}`,
    description: `Full moderation description ${suffix}`,
    area: "UKM Main Campus",
    price: "",
    contact_type: "WhatsApp",
    contact: `contact-${suffix}`,
    image_key: `posts/pending/${suffix}.jpg`,
    event_at: null,
    venue: null,
    club_slug: null,
    club_name: null,
    status: index === 0 ? "hidden" : "published",
    owner_token_hash: `private-${suffix}`,
    moderation_note: null,
    moderated_by: null,
    moderated_at: null,
    version: 1,
    created_at: now + index,
    expires_at: now + 86_400_000,
  }));
  const { env } = createStorage({
    posts,
    reports: [
      {
        id: "report_one", post_id: "post_one", reason: "Reason one", status: "pending",
        resolution: null, resolved_by: null, resolved_at: null, version: 1, created_at: now,
      },
      {
        id: "report_two", post_id: "post_two", reason: "Reason two", status: "pending",
        resolution: null, resolved_by: null, resolved_at: null, version: 1, created_at: now + 1,
      },
      {
        id: "report_three", post_id: "post_three", reason: "Reason three", status: "resolved",
        resolution: "dismiss", resolved_by: "admin", resolved_at: now + 2,
        version: 2, created_at: now + 2,
      },
    ],
  });
  const configuredEnv = {
    ...env,
    KAWAN_ADMIN_EMAIL: "owner@example.test",
    KAWAN_ADMIN_ACCESS_KEY: "correct-admin-key",
  };
  const login = await loginAdmin(env);
  const response = await worker.fetch(new Request(
    "https://example.test/api/admin/reports?status=pending&limit=1&offset=1",
    { headers: { cookie: login.cookies } },
  ), configuredEnv);
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.total, 2);
  assert.equal(payload.limit, 1);
  assert.equal(payload.offset, 1);
  assert.equal(payload.reports.length, 1);
  assert.ok(payload.reports[0].post.description);
  assert.ok(payload.reports[0].post.area);
  assert.ok(payload.reports[0].post.contact);
  assert.match(payload.reports[0].post.imageUrls[0], /^\/api\/admin\/media\?key=/);
  assert.doesNotMatch(JSON.stringify(payload), /owner_token_hash|private-one|private-two/);

  const postsResponse = await worker.fetch(new Request(
    "https://example.test/api/admin/posts?limit=3",
    { headers: { cookie: login.cookies } },
  ), configuredEnv);
  const postsPayload = await postsResponse.json();
  assert.equal(postsPayload.total, 3);
  assert.equal(postsPayload.posts.length, 3);
  assert.ok(postsPayload.posts.every((post) => post.reportCount === 1));

  const searchedPostsResponse = await worker.fetch(new Request(
    "https://example.test/api/admin/posts?status=published&q=listing%20two&limit=50",
    { headers: { cookie: login.cookies } },
  ), configuredEnv);
  const searchedPostsPayload = await searchedPostsResponse.json();
  assert.equal(searchedPostsResponse.status, 200);
  assert.equal(searchedPostsPayload.total, 1);
  assert.equal(searchedPostsPayload.posts.length, 1);
  assert.equal(searchedPostsPayload.posts[0].id, "post_two");
});

test("scheduled cleanup removes temporary uploads and rate windows but permanently retains posts and live media", async () => {
  const now = Date.now();
  const pendingKey = "posts/pending/expired-pending.jpg";
  const postKey = "posts/live/historic-post.jpg";
  const { env, state } = createStorage({
    pendingUploads: [{
      id: "pending_expired",
      image_key: pendingKey,
      session_hash: "pending-hash",
      position: 0,
      created_at: now - 10_000,
      expires_at: now - 1,
    }],
    posts: [{
      id: "post_expired",
      category: "marketplace",
      title: "Historic post",
      description: "This post and its live image must be retained permanently.",
      area: "UKM Main Campus",
      price: "",
      contact_type: "Telegram",
      contact: "expired-contact",
      image_key: postKey,
      event_at: null,
      venue: null,
      club_slug: null,
      club_name: null,
      status: "published",
      owner_token_hash: "expired-owner",
      version: 1,
      created_at: now - 20_000,
      expires_at: now - 1,
    }],
    postImages: [{
      id: "expired_image",
      post_id: "post_expired",
      image_key: postKey,
      position: 0,
      created_at: now - 20_000,
    }],
    rateLimits: [{
      key_hash: "expired-rate-hash",
      action: "report_post",
      window_start: now - 7_200_000,
      count: 2,
      expires_at: now - 1,
    }],
  });
  state.objects.set(pendingKey, { bytes: new Uint8Array(), metadata: {} });
  state.objects.set(postKey, { bytes: new Uint8Array(), metadata: {} });
  let cleanupPromise;
  worker.scheduled({}, env, {
    waitUntil(promise) {
      cleanupPromise = promise;
    },
  });
  await cleanupPromise;

  assert.equal(state.pendingUploads.length, 0);
  assert.equal(state.posts.length, 1);
  assert.equal(state.posts[0].id, "post_expired");
  assert.equal(state.postImages.length, 1);
  assert.equal(state.objects.has(pendingKey), false);
  assert.equal(state.objects.has(postKey), true);
  assert.equal(state.rateLimits.length, 0);
});
