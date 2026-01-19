FROM ethereum/client-go:v1.12.2

# Copy configuration files into the image
COPY geth-boot.sh /root/geth-boot.sh
COPY genesis.json /root/genesis.json
COPY password.txt /tmp/password

# Ensure script is executable
RUN chmod +x /root/geth-boot.sh

ENTRYPOINT ["/root/geth-boot.sh"]
