FROM nginx:alpine

# njs ships with the official image as a dynamic module
RUN sed -i '1i load_module modules/ngx_http_js_module.so;' /etc/nginx/nginx.conf

COPY rpc_filter.js /etc/nginx/njs/rpc_filter.js
COPY default.conf /etc/nginx/conf.d/default.conf
