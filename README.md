# Phase 2 - Implementing Authentication and Authorization Mechanisms
## PhotoShare App
PhotoShare is a secure, full-stack photo sharing application that allows users to register, login (via email or Google), upload and view photos, and like or delete photos based on user roles. Built with Express, MongoDB, Contentful CMS, Passport.js, and secured using JWT, CSRF tokens, and HTTPS.

## Features:
- Secure registration & login (email/password & Google OAuth)
- Upload & view photos (stored on Contentful)
- Like system with limits (0-5)
- Password reset via email
- Admin role with additional photo deletion permissions and assign Admin role
- CSRF protection, secure cookies and other security protection
  
## Setup:
1. Clone the repository
      ```
      git clone https://github.com/PeraltaFrian/photo-sharing.git
      cd photo-sharing
3.  Install dependencies
      ```
       npm install
4. Set Up Environment Variables

      Note: this requires environmental variables which is not uploaded to github

      Create a .env file in the root folder with the following:
      
      ```
      # ----------------------
      # Contentful Settings
      # ----------------------
      CONTENTFUL_SPACE_ID=your_contentful_space_id
      CONTENTFUL_ENVIRONMENT_ID=master
      CONTENTFUL_DELIVERY_TOKEN=your_contentful_delivery_token
      CONTENTFUL_MANAGEMENT_TOKEN=your_contentful_management_token

      # ----------------------
      # HTTPS Certificates
      # ----------------------
      SSL_KEY_PATH=./certs/key.pem
      SSL_CERT_PATH=./certs/cert.pem

      # ----------------------
      # Server Settings
      # ----------------------
      PORT=3000

      # ----------------------
      # JWT Configuration
      # ----------------------
      JWT_SECRET=your_jwt_secret_key
      JWT_REFRESH_SECRET=your_jwt_refresh_secret
      JWT_EXPIRES_IN=15m

      # ----------------------
      # MongoDB
      # ----------------------
      MONGO_URI=mongodb://localhost:27017/photoapp

      # ----------------------
      # SMTP Configuration (for password reset)
      # ----------------------
      SMTP_HOST=smtp.example.com
      SMTP_PORT=587
      SMTP_USER=your_email@example.com
      SMTP_PASS=your_email_app_password
      SMTP_FROM="Your App <your_email@example.com>"

      # Used to generate password reset links
      FRONTEND_URL=https://localhost:3000

      # ----------------------
      # Google OAuth Settings
      # ----------------------
      GOOGLE_CLIENT_ID=your_google_client_id
      GOOGLE_CLIENT_SECRET=your_google_client_secret
      GOOGLE_CALLBACK_URL=https://localhost:3000/auth/google/callback

      # ----------------------
      # Session Secret
      # ----------------------
      SESSION_SECRET=your_super_secret_session_key
### Make sure:
- Set up a MongoDB instance and update MONGO_URI.
- Create a Contentful space and generate your API tokens.
- Configure Google OAuth credentials at console.developers.google.com.
- Use a secure mail provider (e.g., Gmail with App Passwords) for SMTP.
- Make sure your Contentful space has a content type called photoShare with the fields: name, description, image, and like.

4. Generate SSL Certificates (Local Only).

      openssl req -nodes -new -x509 -keyout certs/key.pem -out certs/cert.pem

      This creates a self-signed certificate so the site can run on https://localhost.

5. Start the Server.

      node server.js

      Open https://localhost:3000 in your browser. You may need to accept the security warning due to the self-signed certificate.

# Part A – Design a Secure Authentication System
## Authentication Methods Used
I implemented two primary authentication methods to balance security and usability
1. Local Authentication (Email & Password)
      Users can register with an email and password.
      Passwords are securely hashed using argon2, a modern and secure hashing algorithm.
      Login checks the hash using argon2.verify().
2. Google Single Sign-On (SSO)
      Implemented using Passport.js and the Google OAuth2 strategy.
      New users signing in with Google for the first time are automatically registered.
      Sessions are maintained using express-session.

## Reflection on why I implement there methods?
I choose email/password and Google OAuth2 because they represent a strong balance between usability and security. Local auth is familiar and gives full control over account management. Google SSO improves user convenience, especially for those who prefer not to remember another password. Based on past experience, using Passport.js makes integration smooth and maintainable. Google is a widely trusted provider, and integrating it ensures user confidence and fast onboarding.

## Password Security
Passwords are never stored in plain text. I use argon2 to hash passwords before saving to MongoDB. Password reset functionality is included using a secure token emailed to the user with a 1-hour expiry.

## Session & Cookie Security
Sessions and JWTs are configured with strict security attributes:

      
      res.cookie('refreshToken', refreshToken, {
              httpOnly: true,
              secure: true,
              sameSite: 'Strict',
              path: '/',
              maxAge: 7 * 24 * 60 * 60 * 1000,
      
      });
      
      res.cookie('token', accessToken, {
              httpOnly: true,
              secure: true,
              sameSite: 'Strict',
              path: '/',
              maxAge: 15 * 60 * 1000,
      });

JWTs are used for stateless authentication with short-lived access tokens and a refresh token strategy.

## Password Reset Support
- Users can request a reset link via email.
- A secure, random token is generated and stored with an expiration time.
- The reset link directs users to a frontend page (password-reset.html) where they can set a new password.
- Once changed, the token is invalidated.

# Part B: Control Access with Role-Based Permissions

To enforce varying access levels across different users without sacrificing usability, I implemented a Role-Based Access Control (RBAC) system using JWT and Express middleware.

## Role Definition:
- Unregistered users: Can access public authentication routes like registration, login, and password reset. They cannot access photo features or admin tools until authenticated.
- User (default): Can view and upload photos, like content.
- Admin: Has full privileges including the ability to view all users, assign admin role, and delete photos as well as go to gallery to upload photos, view and like content.

## Role Storage
User roles are:
- Stored in the MongoDB.
- Embedded in the JWT payload during authentication for quick access in middleware.
  
        Example JWT payload:
         {
           "id": "64f1a2...",
           "email": "user@example.com",
           "role": "admin"
         }   

## Middleware-Based Role Enforcement
Access is enforced using middleware functions:
- authenticateToken: Verifies JWT or Passport session and sets req.user.
- requireRole(role): Restricts route access to a specific role.
- requireAdmin: Shortcut to restrict route to 'admin' users only.

## Routes
      Route -> Method -> Description and	Access information
      /auth/register -> POST -> Register a new user -> Public
      /auth/login	-> POST ->	Log in with email and password -> Public
      /auth/logout -> POST ->	Log out and destroy session/cookies -> Authenticated
      /auth/refresh-token -> POST -> Refresh access token from cookie -> Authenticated
      /auth/google -> GET -> Start Google OAuth2 login -> Public
      /auth/google/callback -> GET -> Handle Google login callback -> Public (OAuth flow)
      /auth/csrf-token -> GET -> Get CSRF token -> Authenticated
      /auth/me -> GET -> Get current authenticated user info -> Authenticated
      /auth/password-reset/request -> POST -> Request password reset email ->	Public
      /auth/password-reset/reset -> POST -> Perform password reset with token -> Public
      /photos -> GET ->	Fetch all photo entries -> Authenticated
      /photos -> POST -> Upload a new photo -> Authenticated
      /photos/:id/likes -> PUT -> Update like count for a photo ->Authenticated
      /photos/:id	DELETE -> Delete a photo -> Admin only
      /admin/users -> GET -> Fetch all users (excluding passwords) -> Admin only
      /admin/users/:id/role -> PUT -> Update a user’s role -> Admin only

## Route Access Summary
- Unregistered User - Register, Login, Google OAuth, Password Reset
- User - Upload photos, View photos, Like photos
- Admin - All of the above plus user management and photo deletion

## Session & JWT Integration
- JWT payload includes role and is used server-side to authorize each request.
- Refresh tokens are stored in cookies and used to regenerate access tokens securely.

## Reflection:
How did I structure access control system?

I chose a simple but effective RBAC strategy using a small set of clearly defined roles (user and admin) to keep logic manageable. Role information is embedded in the JWT and checked via middleware per route. Admins get broader access, while users are limited to general functionality.

### Challenges faced:
- Handling dual authentication (JWT and Passport/Google SSO) required flexible middleware that could support both.
- Ensuring consistent role enforcement across all routes meant thoroughly testing.

### Trade-offs:
- A more granular permissions system offers finer control but adds complexity.
- I opted for a simpler role model to preserve usability and meet project scope, balancing security with developer maintainability.

# Part C: Implement JSON Web Tokens (JWT)
To maintain secure user sessions while minimizing friction for users, I implemented JWT-based authentication with refresh token support. This approach enables users to stay logged in across sessions without compromising security.

1. Generate and Verify JWTs

JWTs are issued during login. I created two types of tokens:
- Access Token: Short-lived (15 minutes), used for authenticating user requests.
- Refresh Token: Long-lived (7 days), used to obtain a new access token when the current one expires.
Verification is handled securely in the backend to validate each request:

2. Token Storage Strategy

To protect tokens from XSS attacks, I chose to store tokens in HttpOnly, Secure cookies, rather than localStorage.
This decision improves security because cookies are automatically sent with each request, and cannot be accessed by JavaScript.

3. Token Expiry and Refresh

To maintain a secure and smooth user experience, I implemented a token refresh mechanism. Access tokens are intentionally short-lived (15 minutes) to reduce the risk if they are ever compromised. Rather than forcing users to log in again when the access token expires, the system uses a refresh token (valid for 7 days) to silently issue a new access token.

The refresh token is stored securely in an HttpOnly cookie and sent automatically with each request. When the frontend detects an expired access token, it calls the /refresh-token endpoint. 

4. Session Continuity + Expired Token Handling

When the access token expires, the frontend silently calls the /refresh-token endpoint using the refresh token stored in the cookie. If the refresh token is still valid, a new access token is issued, allowing the user to stay logged in without interruption.

If the refresh token is invalid or expired, the user is redirected to the login page to authenticate again.

5. Middleware Protection

I created a reusable middleware to protect API routes. It checks for a valid access token either in cookies or the Authorization header.

## Reflection

My goal was to prevent common token-related vulnerabilities without compromising user experience. To protect against cross-site scripting (XSS) attacks, I chose to store tokens in HttpOnly cookies, which prevent client-side JavaScript from accessing sensitive authentication data. To minimize the impact of a potentially stolen token, I implemented short-lived access tokens. At the same time, I used longer-lived refresh tokens to maintain session continuity, allowing users to stay logged in without constant interruptions. Additionally, I created middleware to enforce role-based access control in a centralized and maintainable way, ensuring only authorized users can access protected routes.

## Challenges Faced
Implementing token refresh logic required tight coordination between the frontend and backend to ensure seamless session management. Balancing strong session security with user convenience proved challenging especially when trying to avoid forced logouts after access token expiry. Another hurdle was debugging cookie behavior across different environments; for example, the SameSite=Strict setting caused unexpected issues during local development and cross-origin requests, making it difficult to test authentication flows consistently.

## Security vs UX Trade-Offs:
Throughout the project, I had to carefully weigh security against usability. To mitigate XSS risks, I stored tokens in HttpOnly cookies, which required adding CSRF protection since client-side code couldn't access them. Role-based middleware was used to prevent token misuse, though it introduced a slight processing cost on protected routes. For better session continuity, I implemented refresh token logic to avoid constant logins, but this added complexity to the frontend. Finally, to prevent session fixation attacks, I regenerated the session ID after login, which meant integrating session handling cleanly with the JWT-based authentication system.

# Part D: Mitigate Security Risks
Session security is essential to any system. In this project, I implemented several protective measures to mitigate session hijacking, CSRF, brute-force attacks, and session fixation while maintaining a smooth user experience.

1. Secure Session Cookie Configuration

Sessions are configured with strong, secure cookie attributes to protect against common web vulnerabilities:

      ```
      app.use(session({
        secret: process.env.SESSION_SECRET || 'keyboard cat',
        resave: false,
        saveUninitialized: false,
        cookie: {
          secure: true,                 // Cookies sent only over HTTPS
          httpOnly: true,              // Inaccessible via JavaScript (mitigates XSS)
          sameSite: 'Strict',          // Blocks cross-site requests (CSRF defense)
          maxAge: 60 * 60 * 1000,      // 1 hour session timeout
        },
      }));

- secure: true = Enforces cookies over HTTPS only. Required in production with HTTPS.
- httpOnly: true  = Prevents client-side scripts from accessing the cookie, protecting against XSS.
- sameSite: 'Strict' =  Prevents cookies from being sent in cross-origin requests, mitigating CSRF attacks.
- maxAge : Controls the session expiration time.

2. Session Timeout Policy

I configured session cookies with a maxAge of 1 hour, meaning sessions automatically expire after 60 minutes. This limits the time window an attacker could reuse a stolen session cookie, reducing the risk of session hijacking.

3. CSRF Protection
Cross-Site Request Forgery (CSRF) protection is implemented using the csurf middleware. This ensures that state-changing requests (like form submissions or API calls) are intentionally made by authenticated users, not malicious third parties.

   ```
   const csrfProtection = csurf({ cookie: true });

The CSRF token is made available to the frontend via a dedicated endpoint:

      app.get('/csrf-token', csrfProtection, (req, res) => {
           const token = req.csrfToken();
           res.cookie('csrfToken', token, {
             httpOnly: false,
             sameSite: 'Lax',
             secure: true,
           });
           res.json({ csrfToken: token });
         });

This allows the frontend to fetch the CSRF token and include it in headers or form submissions when making authenticated requests. The server verifies the token to ensure the request is legitimate.

4. Prevent Account Enumeration

To protect against account enumeration attacks, the password reset route returns a generic response regardless of whether the email exists in the system:

      ```
      return res.status(200).json({ message: 'Reset email sent if account exists.' });

This ensures that attackers cannot use the API to determine if a given email address is registered. By not revealing whether the user exists, the application avoids leaking information that could be exploited in targeted attacks.

5. Rate Limiting on Login

To defend against brute-force login attempts, the /auth/login route is rate-limited:

      ```
      app.use('/auth/login', rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 5,
        message: { error: 'Too many login attempts.' }
      }));
      
This configuration allows a maximum of 5 login attempts per 15-minute window from a single IP address. If the limit is exceeded, further attempts are blocked temporarily. This helps protect user accounts from automated guessing attacks.

6. Session Fixation Protection

During login, the session is regenerated to create a new session ID:
      
      ```
      req.session.regenerate((err) => {
            if (err) {
              console.error('Session regen failed:', err);
              return res.status(500).json({ error: 'Session error' });
            }
      
            req.session.userId = user._id;
      
            const accessToken = generateAccessToken(user);
            const refreshToken = generateRefreshToken(user);
      
            res.cookie('refreshToken', refreshToken, {
              httpOnly: true,
              secure: true,
              sameSite: 'Strict',
              path: '/',
              maxAge: 7 * 24 * 60 * 60 * 1000,
      
            });
      
            res.cookie('token', accessToken, {
              httpOnly: true,
              secure: true,
              sameSite: 'Strict',
              path: '/',
              maxAge: 15 * 60 * 1000,
        
            });
      
            res.json({ message: 'Login successful.', token: accessToken });
          });
        } catch (err) {
          console.error('Login error:', err);
          res.status(500).json({ error: 'Server error during login.' });
        }
      });


This ensures that any existing session ID is replaced with a new one upon authentication, preventing session fixation attacks where an attacker forces a user to use a known session ID.

## Reflection: Security vs Usability

Risks Identified & Mitigated:
Throughout the project, several key security risks were identified and addressed. To protect against XSS attacks and token theft, I used HttpOnly cookies instead of storing tokens in localStorage. CSRF vulnerabilities were mitigated using the csurf middleware alongside SameSite: 'Strict' cookies, which ensure cookies aren't sent on cross-origin requests. To defend against session hijacking, I set short session timeouts and used secure cookie flags (Secure, HttpOnly, SameSite). I also addressed session fixation by regenerating the session ID after each successful login. To block brute-force attacks, I added rate limiting to the login route, and to prevent account enumeration, I used generic responses for login and password reset endpoints.

## Design Decisions:

I chose to use HttpOnly, Secure, and SameSite cookie attributes to improve security without significantly complicating frontend logic. Although CSRF protection introduced a layer of complexity, I made it manageable by exposing the CSRF token through a dedicated /csrf-token endpoint and sending it in a readable cookie (_csrf). This allowed the frontend to retrieve and attach the token easily in protected requests. Regenerating the session after login also improved security by reducing the risk of session fixation, and this came with only a minor performance trade-off.

## Challenges Faced:

Some challenges included debugging cookie behavior especially during local development where SameSite: 'Strict' occasionally blocked expected flows. Setting up CSRF protection required tight coordination between frontend and backend, especially for asynchronous forms. Another tricky balance was between short session expiration (for security) and seamless user experience, which is solved by implementing refresh token logic to silently issue new access tokens without forcing re-authentication.

# Part E: Test and Debug Security
After implementing the authentication and session management, I conducted thorough testing to ensure everything was secure and functioning as intended.

1. Authentication Method Testing

Local Authentication (Email + Password)

I tested registration and login flows using both valid and invalid credentials. I verified session persistence and ensured that password hashing worked correctly using Argon2. At no point was the password ever stored in plaintext.

Google OAuth (SSO)

I validated the OAuth login via the /auth/google route, confirming that the callback logic redirected users to the correct destination based on their role (admin or user). After login, I confirmed that a valid JWT was generated and stored securely in an HttpOnly cookie.

Session Debugging

Using browser DevTools, I inspected session cookies to confirm that the HttpOnly, SameSite, and Secure attributes were correctly applied. I also verified that sessions were properly destroyed on logout and that the authentication state reset accordingly.

2. Secure Token Lifecycle Testing

Access Tokens

Tokens are short-lived (15 minutes), signed securely with a server-side secret, and stored in HttpOnly cookies. I verified that expired or tampered tokens were rejected by middleware.

Refresh Tokens

Refresh tokens are issued alongside access tokens and stored securely. I manually tested the /refresh-token route to ensure that expired access tokens could be renewed without logging out.

Token Failure Scenarios

I also tested what happens when tokens expire, ensuring that users are prompted to re-authenticate.

3. Simulated Attacks

To test the strength of the authentication system, I simulated several common attacks. For CSRF, I sent POST requests without a valid CSRF token, and the server correctly responded with 403 errors. I also tested session fixation by trying to reuse a session ID after login, but the app regenerated the session, blocking the attempt.

To check brute-force protection, I triggered multiple failed logins in a row, which were limited by the rate limiter as expected. Admin-only routes were tested by logging in as a regular user and trying to access them access was correctly denied.

All the simulated attacks were blocked successfully, which confirmed that key security protections were working as intended.

4. Authorization and Access Control Testing

To verify that authorization and access control were working correctly, I manually tested each protected route using Postman and browser sessions. For the /admin/users route, I confirmed that only users with the admin role could access it, regular users were correctly blocked. When testing the /photos route for POST and DELETE requests, only authenticated users with a valid JWT were able to proceed, confirming token-based access control. The /auth/me route was also tested to ensure it required a valid token and returned accurate user information when provided. Finally, I checked the /photos/:id/likes endpoint and verified that it was accessible only to authenticated users, with proper validation applied using the token. Each route behaved as expected based on the user's role and session status.

## Reflection: Testing Strategy, Trade-offs and Prioritization

To test and fix the authentication system, I used manual checks and logged important info during login and token use. I looked at how cookies worked and watched the token’s creation and expiration. During testing, I found some problems. Sometimes the CSRF token wasn’t sent, so I added code on the client to read the CSRF cookie. The session ID wasn’t changing after login, so I fixed that by regenerating the session to stop session fixation. Some admin pages weren’t protected, so I added checks to make sure only admins can access them. These changes made the system safer and more reliable.

I focused on the most critical flows first—login, logout, and session persistence then moved to token based logic and role based access control. I prioritized attacks that could escalate privileges or hijack sessions before fine-tuning frontend behavior.

I successfully tested both local login and OAuth-based authentication to ensure they work correctly. I simulated major attacks such as CSRF, session fixation, and brute force attempts, and verified that the system blocked them effectively. I also debugged issues related to sessions, tokens, and cookies to ensure consistent behavior. Finally, I confirmed that access control is reliable and secure by validating tokens and user roles on protected routes.

# Part F: Documenting the Solution
This README is structured to help set up and understand the PhotoShare application.

## Setting Up the Repository

See Setup section at the top of this README for detailed instructions on how to:
- Cloning the repository
- Installing dependencies
- Creating and configuring the .env file with required secrets for MongoDB, Contentful, SMTP, JWT, and Google OAuth
- Generating SSL certificates for HTTPS on localhost
- Running the server and accessing the app via https://localhost:3000

Note: Since environment variables contain sensitive data, they are excluded from version control. You must configure your own .env file based on the template provided in the README.

Ensure the following are configured before running the app:
- A local MongoDB instance
- A Contentful space with a content type named photoShare (fields: name, description, image, like)
- Google OAuth credentials at console.developers.google.com
- SMTP credentials for email/password reset functionality

## Authentication Mechanisms

Described in Part A: Design a Secure Authentication System, covering:
- Local (email/password) authentication using Argon2
- Google OAuth2 (SSO) integration via Passport.js
- JWT-based access and refresh tokens
- Session and cookie configuration
- Password reset with email verification

## Role-Based Access Control

Explained in Part B: Control Access with Role-Based Permissions, including:
- Role definitions (user, admin)
- Role assignment and storage in JWT
- Access control middleware and protected routes

## Lessons Learned & Reflections

Reflections are included at the end of each part for better context:

Part A: Choosing local + OAuth

Part B: Structuring role-based access

Part C: Token lifecycle design trade-offs

Part D: Balancing security with user experience

Part E: Testing priorities and fixes applied

These reflections document the key decisions, trade-offs, and debugging processes 

## Demo Video

A short demo video is recorded to showcase:
- Local and Google login/logout flows
- Role-based access: user vs admin
- Token expiration and refresh logic in action
- Navigation to protected routes

# ----------------- END OF PHASE 2 README -----------------



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

      Note: this requires SLL Certificates which are not uploaded to github
   
      Create a certs/ folder in the project directory -> Run the OpenSSL command in the terminal.

      openssl req -nodes -new -x509 -keyout certs/key.pem -out certs/cert.pem

      This creates a self-signed certificate so the site can run on https://localhost.

8. Start the Server.

      node server.js

      Open https://localhost:3000 in your browser. You may need to accept the security warning due to the self-signed certificate.

## Structure
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

2. Run the OpenSSL command in the terminal:

      openssl req -nodes -new -x509 -keyout certs/key.pem -out certs/cert.pem
   
4. Filled in dummy certificate information (e.g., country, common name, etc.).
5. Updated my .env file to include:

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

## The main challenges I faced were:

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


