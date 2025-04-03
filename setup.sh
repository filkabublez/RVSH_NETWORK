mkdir -p rvsh-network/{public/{css,js,images},server}

cd rvsh-network

npm init -y

npm install express sqlite3 cookie-parser body-parser
npm install --save-dev nodemon 