# CSE356 Warm-Up Project 2

## Local Development

Run `docker compose up`

## Commands to run in the server in case of restart
1. sudo iptables -t nat -A PREROUTING -p tcp --dport 80 -j REDIRECT --to-ports 3000
2. ip6tables -I OUTPUT -p tcp -m tcp --dport 25 -j DROP
3. iptables -t nat -I OUTPUT -o eth0 -p tcp -m tcp --dport 25 -j DNAT --to-destination 130.245.171.151:11587
