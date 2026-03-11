FROM ethereum/client-go:v1.12.2

# Copy configuration files into the image
COPY geth-boot.sh /root/geth-boot.sh
COPY genesis.json /root/genesis.json
COPY password.txt /tmp/password

# Install jq to dynamically modify genesis configuration on boot
RUN apk add --no-cache jq

# Ensure script is executable
RUN chmod +x /root/geth-boot.sh

ENTRYPOINT ["/root/geth-boot.sh"]
