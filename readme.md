HQ instagram clone

## Deploy (Render)

1. Push latest code to GitHub.
2. Create a MongoDB Atlas cluster and copy the connection string.
3. In Render, create a new Web Service from this GitHub repository.
4. Set:
	- Build Command: `npm install`
	- Start Command: `npm start`
5. Add environment variables in Render:
	- `MONGODB_URI` = your Atlas URI
	- `SESSION_SECRET` = long random string
	- `NODE_ENV` = `production`
6. Deploy and open the generated `onrender.com` URL.

Note: image uploads are stored on local disk (`public/images/uploads`).
On many free hosts, local files may reset after redeploy/restart.
For persistent media, use cloud storage (Cloudinary/S3).