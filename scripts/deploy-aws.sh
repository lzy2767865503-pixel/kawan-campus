#!/usr/bin/env bash

set -euo pipefail

project_directory="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
template_file="${project_directory}/infra/aws/kawan-campus.yaml"
build_directory="${project_directory}/dist/client"
aws_region="${AWS_REGION:-ap-southeast-1}"
stack_name="${KAWAN_AWS_STACK_NAME:-kawan-campus-production}"
cloudflare_origin="${KAWAN_CLOUDFLARE_ORIGIN:-kawan-campus.lzy2767865503.workers.dev}"

if ! command -v aws >/dev/null 2>&1; then
  printf 'AWS CLI is required. Run this script in AWS CloudShell or install AWS CLI v2.\n' >&2
  exit 1
fi

if [[ ! -f "${build_directory}/index.html" ]]; then
  printf 'Production build not found. Run npm run build first.\n' >&2
  exit 1
fi

aws sts get-caller-identity >/dev/null

aws cloudformation deploy \
  --region "${aws_region}" \
  --stack-name "${stack_name}" \
  --template-file "${template_file}" \
  --parameter-overrides "CloudflareOriginDomain=${cloudflare_origin}" \
  --no-fail-on-empty-changeset

bucket_name="$(
  aws cloudformation describe-stacks \
    --region "${aws_region}" \
    --stack-name "${stack_name}" \
    --query "Stacks[0].Outputs[?OutputKey=='BucketName'].OutputValue" \
    --output text
)"

distribution_id="$(
  aws cloudformation describe-stacks \
    --region "${aws_region}" \
    --stack-name "${stack_name}" \
    --query "Stacks[0].Outputs[?OutputKey=='DistributionId'].OutputValue" \
    --output text
)"

production_url="$(
  aws cloudformation describe-stacks \
    --region "${aws_region}" \
    --stack-name "${stack_name}" \
    --query "Stacks[0].Outputs[?OutputKey=='ProductionUrl'].OutputValue" \
    --output text
)"

if [[ -z "${bucket_name}" || -z "${distribution_id}" || -z "${production_url}" ]]; then
  printf 'AWS stack outputs are incomplete; deployment was not finalized.\n' >&2
  exit 1
fi

aws s3 sync \
  "${build_directory}" \
  "s3://${bucket_name}" \
  --region "${aws_region}" \
  --delete \
  --cache-control "public,max-age=3600"

aws s3 cp \
  "${build_directory}/index.html" \
  "s3://${bucket_name}/index.html" \
  --region "${aws_region}" \
  --cache-control "no-cache,no-store,must-revalidate" \
  --content-type "text/html"

aws cloudfront create-invalidation \
  --distribution-id "${distribution_id}" \
  --paths "/*" >/dev/null

printf 'Kawan Campus AWS deployment is live at %s\n' "${production_url}"
