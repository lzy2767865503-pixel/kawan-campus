property adminURL : "https://kawan-campus-malaysia.lzy2767865503.chatgpt.site/#admin"

on run
	try
		do shell script "/usr/bin/open -a " & quoted form of "/Applications/Google Chrome.app" & " " & quoted form of adminURL
	on error
		do shell script "/usr/bin/open " & quoted form of adminURL
	end try
end run
