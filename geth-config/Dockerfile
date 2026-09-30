FROM ethereum/client-go:v1.13.15

# Copy configuration files into the image. The signer key and its password
# are generated on first boot inside the data volume (see geth-boot.sh).
COPY geth-boot.sh /root/geth-boot.sh
COPY genesis.template.json /root/genesis.template.json

# Ensure script is executable
RUN sed -i 's/\r$//' /root/geth-boot.sh && chmod +x /root/geth-boot.sh

ENTRYPOINT ["/root/geth-boot.sh"]
