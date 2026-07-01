FROM ethereum/client-go:v1.13.15

# Copy configuration files into the image
COPY geth-boot.sh /root/geth-boot.sh
COPY genesis.json /root/genesis.json
COPY password.txt /tmp/password

# Install jq to dynamically modify genesis configuration on boot
RUN apk add --no-cache jq

# Ensure script is executable
RUN sed -i 's/\r$//' /root/geth-boot.sh && chmod +x /root/geth-boot.sh

ENTRYPOINT ["/root/geth-boot.sh"]
