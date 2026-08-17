目前，该服务启动装填如下：
```
curl --location 'http://8.138.230.242:3738/api/search/unsplash' \
--header 'Content-Type: application/json' \
--data '{"q":"santorini"}'
```

### 问题1

当通过如下命令，可以获取内容：
```
curl --location 'http://8.138.230.242:3738/api/search/unsplash' \
--header 'Content-Type: application/json' \
--data '{"q":"santorini"}'
```

但是，通过如下命令，无法获取内容：
```
curl --location 'http://8.138.230.242:3738/api/search/pexels' \
--header 'Content-Type: application/json' \
--data '{"q":"Salzburg"}'
```
系统返回：
```
{
    "error": "Failed to fetch images from Pexels."
}
```
### 问题2
我的反向代理设置如下：
root@iZ7xvgdecbg6zhwa8m2gc8Z:/etc/nginx/conf.d# cat sugotrip.com.conf

我在浏览器输入 `https://www.sugotrip.com/3738/` ，浏览器显示如下错误：
```
Blocked request. This host ("www.sugotrip.com") is not allowed.
To allow this host, add "www.sugotrip.com" to `server.allowedHosts` in vite.config.js.
```
#### 补充 
- www.sogutrip.com 是可以打开的
- 在另外一台服务器，不设置证书 和 nginx 可以通过 IP:PORT  正确打开
