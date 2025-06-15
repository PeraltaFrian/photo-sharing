# Phase 1 - Photo Sharing App – Web Security Assignment:

A simple photo sharing web application where users can upload, view, and like images. I have not included  Community-focused features like follow at Phase 1 of the assignment. 

## App Features
- Users can upload a photo (image + name + description).
- All uploaded photos are stored in Contentful.
- Users can “like” photos (likes are stored in Contentful too).
- Photos are displayed in a gallery format with the enlarge version at the right side when user click or select an individual photo
- Basic validation is handled on upload.

## Setup:

1. Clone the repository

   git clone https://github.com/PeraltaFrian/photo-sharing.git

   cd photo-sharing

3.  Install dependencies

          npm install

5. Set Up Environment Variables

      Note: this requires environmental variables which is not uploaded to github

      Create a .env file in the root folder with the following:
      
         # Contentful Settings
               CONTENTFUL_SPACE_ID=your_space_id
               CONTENTFUL_ENVIRONMENT_ID=master
               CONTENTFUL_DELIVERY_TOKEN=your_delivery_token
               CONTENTFUL_MANAGEMENT_TOKEN=your_management_token

         # HTTPS Certs
               SSL_KEY_PATH=./certs/key.pem
               SSL_CERT_PATH=./certs/cert.pem
         # Server Port
               PORT=3000 

     Make sure your Contentful space has a content type called photoShare with the fields:  
     name, description, image, and like.

6. Generate SSL Certificates (Local Only).

      openssl req -nodes -new -x509 -keyout certs/key.pem -out certs/cert.pem

      This creates a self-signed certificate so the site can run on https://localhost.

7. Start the Server.

      node server.js

      Open https://localhost:3000 in your browser. You may need to accept the security warning due to the self-signed certificate.

# Structure
- /public: Contains frontend HTML,CSS, JS
- /certs: SSL certificates (self-signed for dev and not included in repo)
- server.js: Main Express app with routing, HTTPS, caching, and security
- .env: Environment config (not included in repo)

Note: This app runs only on `https://localhost` with a self-signed certificate. If the intention is to deploy to a cloud platform, then a real certificate and domain is needed.

## How to Use

1. Visit `https://localhost:3000`
2. Use the upload form to add a photo (image, name, description)
3. Click on any photo to view it larger on the right (big screen) or bottom (small screen)
4. Click dropdown to choose the photo's likes (max 5)

# PART B:
## SSL Setup and Reflection:

For this assignment, I chose to use OpenSSL to generate a self-signed SSL certificate for local development. Since the application is not deployed online and only runs on localhost, a self-signed certificate was the most practical and efficient option. It allowed me to implement HTTPS without needing a domain or relying on third-party services like Let’s Encrypt, which are better suited for live production environments.

I followed these steps to generate the certificate:

1. Created a certs/ folder in the project directory.

2. Ran the OpenSSL command in the terminal:

      openssl req -nodes -new -x509 -keyout certs/key.pem -out certs/cert.pem
3. Filled in dummy certificate information (e.g., country, common name, etc.).
4. Updated my .env file to include:

         # HTTPS Certs
               SSL_KEY_PATH=./certs/key.pem
               SSL_CERT_PATH=./certs/cert.pem
         # Server Port
               PORT=3000 

6.  In server.js, I used Node's https.createServer() method and passed in the key and certificate files to launch the app securely over HTTPS on port 3000.

Although browsers display a warning with self-signed certificates, this method allowed me to test HTTPS functionality and secure headers in a real-world-like environment. I now feel more confident about implementing proper SSL in future projects. Overall, this setup was ideal for local development and matched the scope of this assignment.

# PART C: 
## Secure HTTP Headers
## HTTPS Server Set-up
I integrated a self-signed SSL certificate using OpenSSL for local development. The Express server uses https.createServer() with key.pem and cert.pem stored in the /certs folder. This ensures all traffic is encrypted end-to-end, even during testing.
## Helmet Middleware Configuration
To secure the application at the HTTP layer, I used Helmet.js, which sets a variety of security-related HTTP headers. Below are the headers I implemented and the rationale behind each:
- Content-Security-Policy: Limited image sources to server and Contentful CDN. Prevents Cross-Site Scripting (XSS) by disallowing unauthorized sources.
- X-Content-Type-Options: nosniff - Prevents MIME-type sniffing.
- X-Frame-Options: DENY - Helps prevent clickjacking.
- X-XSS-Protection: Adds basic XSS protection.


      app.use(
         helmet({
           contentSecurityPolicy: {
              directives: {
                    defaultSrc: ["'self'"], imgSrc: ["'self'", "https://images.ctfassets.net", "data:"],
                    scriptSrc: ["'self'", "'unsafe-inline'"],
                    styleSrc: ["'self'", "'unsafe-inline'"],
              },
           },
         })
      ); 

CSP significantly lowers the chance of successful Cross-Site Scripting (XSS) by restricting where scripts, images, and styles can load from. I allowed only 'self', unsafe-inline (temporarily for dev), and trusted image sources (Contentful CDN).

These headers establish a hardened baseline for browser behavior, helping to enforce policies and reduce attack surfaces. Together, they provide strong browser-level defenses to augment server-side validation.

# The main challenges I faced were:

1. Self-Signed SSL Warnings in Browser: Initially, the browser would block access due to the untrusted certificate authority. I resolved this by manually accepting the risk in the browser (as expected during local development).

2. Content Security Policy (CSP) Blocking Assets: CSP initially blocked inline scripts and styles, which caused my client-side JavaScript to fail. To resolve this:
 * I allowed 'unsafe-inline' temporarily for development.
 * I explicitly whitelisted the Contentful CDN (images.ctfassets.net) for images.
 * I confirmed the CSP directive was not overly broad to avoid reducing its effectiveness.

# PART D:
## Design Routes and Implement Cache Control
I have defined six core routes in the Photo Sharing App. Each route serves a clear purpose and includes an appropriate caching policy that balances speed with security. All cache control strategies are explicitly documented and tailored to the app’s needs.

- Route 1: GET /photos

        - Purpose: Returns all photo posts from Contentful to populate the gallery view.
        - Caching Policy: Cache-Control: public, max-age=300, stale-while-revalidate=60
        - Reason: Improves performance by letting browsers and CDNs cache the photo feed for 5 minutes. The stale-while-revalidate directive allows the browser to serve a slightly outdated version while revalidating in the background — speeding up response time without sacrificing freshness.
        - Security: Only public data is included (image, description, likes), so caching poses no privacy risk.

- Route 2: GET /photos/:id

        - Purpose: Retrieves a specific photo by its unique ID.
        - Caching Policy: Cache-Control: public, max-age=300
        - Reason: Individual photo content is static and safe to cache short-term. Helps reduce server load and speeds up page transitions. I included it in my server.js but I am not using it now for my front-end, I intend to use it in future phases of the assignment.
        - Security: Currently, all photos are public. In future phases, sensitive images could be role-restricted.

- Route 3: POST /photos

        - Purpose: Allows users to upload new photos via the form.
        - Caching Policy: Cache-Control: no-store
        - Reason: Upload routes involve user input and should never be cached. Ensures that no sensitive data or file references are stored in the browser or intermediary caches.
        - Security: Prevents replay attacks or accidental resubmissions by keeping responses out of cache entirely.

- Route 4: POST /photos/:id/like

        - Purpose: Lets users like a photo, incrementing its like count up to a maximum.
        - Caching Policy: Cache-Control: no-store
        - Reason: Likes should reflect real-time interaction. Prevents stale data or incorrect like counts due to caching.
        - Security: Ensures accurate and immediate updates to content stored on the server.

- Route 5: GET /health

        - Purpose: Health check for uptime and monitoring tools.
        - Caching Policy: Cache-Control: no-store
        - Reason: This health check improves reliability by enabling automatic monitoring and maintenance of the application in production. It is no-store because this route should not be cache. Every request should return fresh, real-time status. Caching could lead to false positives or hide downtime.
        - Security: Only basic non-sensitive status info returned. It is safe to keep this endpoint publicly accessible for monitoring purposes.

- Route 6: GET / (Static files: HTML, JS, CSS)

        - Purpose: Serves the UI and frontend logic from the /public directory.
        - Caching Policy: Cache-Control: public, max-age=600
        - Reason: These files rarely change during active use, so caching them for 10 minutes improves load time. Suitable for client-side assets like stylesheets and scripts.
        - Security: As these files don’t contain sensitive info, caching them is safe and efficient.

## Caching Strategy
Each route was analyzed to determine whether its content benefits from caching and whether that caching could introduce security risks.
* Public, non-sensitive data (photos, UI files) is cached briefly to improve speed and reduce server load.
* GET /photos and GET /photos/:id use 5-minute cache with optional stale-while-revalidate to balance performance and freshness.
* Static assets (.js, .css, .html) are cached for 10 minutes for performance.
* Dynamic or user-interactive routes (uploads and likes) explicitly disable caching to preserve data integrity and protect against replay vulnerabilities.

## Trade-Offs and Design Choices
* I used stale-while-revalidate on the main photo listing route (GET /photos) to balance freshness with user experience. This means users get quick responses, and the data quietly updates in the background.
* For likes and uploads, I made a clear trade-off in favor of security and accuracy over performance, using no-store.
* I used short max-age values (5–10 minutes) to avoid outdated content and ensure recent posts appear without requiring a hard refresh.

# Reflection & Lessons Learned

This assignment was a great way to understand web security in practice. I often hear about HTTPS and secure headers, but implementing them myself made the concepts more real.

# Challenges faced:

- Contentful Errors: I kept getting 422 Unprocessable Entity errors. It turns out that since I set the like field in Contentful to only accept values from 1 to 5, but I was trying to start at 0. I updated the model to allow 0 as a valid value.

- Waiting for Assets: Asset processing in Contentful is asynchronous. I had to poll the asset status before publishing it, which I handled using a loop.

- CSP Blocking Images: The images weren’t loading at first because my Content Security Policy (img-src) didn’t allow external domains. I added Contentful’s CDN (images.ctfassets.net) to fix it.

# What I learned:
- How to generate and configure a self-signed SSL certificate to run a secure HTTPS server locally.
- Using Helmet middleware to enhance security by setting various HTTP headers in an Express.js app.
- The critical importance of verifying data model constraints when working with headless CMS platforms like Contentful to avoid errors.
- How caching strategies can significantly improve app performance but must be carefully designed to prevent security or data consistency issues.


