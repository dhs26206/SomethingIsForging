const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const PORT_RANGE_START = 5000;
const PORT_RANGE_END = 6000;

async function isPortInUse(port) {
    try {
        const result = execSync(`netstat -tuln | grep ":${port}"`);
        return result.toString().length > 0;
    } catch (error) {
        return false; // Port is free
    }
}

async function findFreePort() {
    try {
        // Read the starting port value asynchronously
        const data = fs.readFileSync('variable.txt', 'utf-8');
        let port_start = parseInt(data.trim(), 10);

        for (let port = port_start; port <= PORT_RANGE_END; port++) {
            let response = await isPortInUse(port);
            if (!response) {
                // Write the new port back to variable.txt
                fs.writeFileSync('variable.txt', port.toString());
                return port; // Return the free port
            }
        }
    } catch (err) {
        console.error("Error reading or writing the file:", err);
    }
}

async function configureNginxFrontEndStatic(id, port,deployDirectory) {
    const domain = `${id}.server.ddks.live`;
    const user=id;
    const dir=deployDirectory;
    const nginxConfig = `
server {
    listen 80;
    server_name ${domain};

    # Redirect all HTTP requests to HTTPS
    location / {
        return 301 https://$host$request_uri;
    }
}

server {
    listen 443 ssl;
    server_name ${domain};

    # SSL configuration
    ssl_certificate /etc/letsencrypt/live/server.ddks.live/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/server.ddks.live/privkey.pem;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;

    # Serve static files from /home/abc/build
    root /home/${id}/${dir};

    location / {
        try_files $uri $uri/ =404;
    }

    
    location /index.html {
        try_files $uri /index.html =404;
    }

    # Handle static assets (CSS, JS, etc.)
    location /static/ {
        try_files $uri =404;
    }

    # Optionally set some caching for static files (optional for performance)
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 30d;
        add_header Cache-Control "public, no-transform";
    }
}
`;

    const configPath = `/etc/nginx/sites-available/${domain}`;
    fs.writeFileSync(configPath, nginxConfig);

    // Create symbolic link to enable site
    const enabledPath = `/etc/nginx/sites-enabled/${domain}`;
    if (!fs.existsSync(enabledPath)) {
        execSync(`ln -s ${configPath} ${enabledPath}`);
    }

    
    

    // Reload Nginx
    execSync(`sudo setfacl -m u:www-data:rx /home/${user}`)
    execSync('nginx -t && systemctl reload nginx');

    return port;
}

async function configureNginxBackend(id, port) {
    const domain = `${id}.server.ddks.live`;
    const user=id;
    // const dir=deployDirectory;
    const nginxConfig = `
server {
    listen 80;
    server_name ${domain};

    # Redirect all HTTP requests to HTTPS
    location / {
        return 301 https://$host$request_uri;
    }
}

server {
    listen 443 ssl;
    server_name ${domain};

    # SSL configuration
    ssl_certificate /etc/letsencrypt/live/server.ddks.live/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/server.ddks.live/privkey.pem;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;

    # Reverse proxy to localhost:${port}
    location / {
        proxy_pass http://localhost:${port};
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Serve static assets from the reverse-proxied application if needed
    location /static/ {
        proxy_pass http://localhost:${port};
        expires 30d;
        add_header Cache-Control "public, no-transform";
    }

    # Optionally set some caching for static files (optional for performance)
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 30d;
        add_header Cache-Control "public, no-transform";
    }
}

`;

    const configPath = `/etc/nginx/sites-available/${domain}`;
    fs.writeFileSync(configPath, nginxConfig);

    // Create symbolic link to enable site
    const enabledPath = `/etc/nginx/sites-enabled/${domain}`;
    if (!fs.existsSync(enabledPath)) {
        execSync(`ln -s ${configPath} ${enabledPath}`);
    }

    
    

    // Reload Nginx
    execSync(`sudo setfacl -m u:www-data:rx /home/${user}`)
    execSync('nginx -t && systemctl reload nginx');

    return port;
}




// Main function
async function reservePort(id,deployDirectory,type) {
    
    const port =await findFreePort();
    console.log(`Reserve Port In Final Depoy Triggered ${id} ${deployDirectory} ${type}`)
    if(type===0) return (await configureNginxFrontEndStatic(id,port,deployDirectory));
    else return (await configureNginxBackend(id,port))
}
    

module.exports = {reservePort,isPortInUse,findFreePort,configureNginxFrontEndStatic};
