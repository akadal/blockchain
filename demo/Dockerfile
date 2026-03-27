FROM nginx:alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY index.html /usr/share/nginx/html/
COPY css/ /usr/share/nginx/html/css/
COPY js/ /usr/share/nginx/html/js/

# Entrypoint dosyasını ekle
COPY entrypoint.sh /docker-entrypoint.d/99-entrypoint.sh
RUN chmod +x /docker-entrypoint.d/99-entrypoint.sh

EXPOSE 3000

CMD ["nginx", "-g", "daemon off;"]
