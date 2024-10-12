sudo apt update

sudo apt install -y  nginx zip unzip net-tools certbot python3-certbot-nginx cgroup-tools npm docker.io
chmod +x scripts/*.sh
echo "Configuring SSL Certificate"

sudo certbot certonly --manual --preferred-challenges=dns -d "*.server.ddks.live" -d "server.ddks.live"

sudo docker pull mongo
sudo docker run -d -p 27017:27017 --name mongodb mongo

npm install --global serve
echo "All Done"