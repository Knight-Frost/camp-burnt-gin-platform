# Camp Burnt Gin – Frontend Issue Report

## Instructions
- Create a new section for each issue.
- Be clear and specific.
- Include screenshots if possible.
- Do NOT group multiple issues into one entry.
- One issue = one section.

---

## Issue #1 – [Short Title of Problem]

### 1. Page / Location
Example: Login Page / Dashboard / Registration Form

### 2. Type of Issue
- [ ] UI Design
- [ ] UX Problem
- [ ] Functional Bug
- [ ] Validation Issue
- [ ] Broken Link
- [ ] Performance Issue
- [ ] Accessibility Issue
- [ ] Other: ________

### 3. Description
Clearly describe what is wrong.

### 4. Steps to Reproduce
1. Go to ___
2. Click ___
3. Enter ___
4. Observe ___

### 5. Expected Behavior
Explain what SHOULD happen.

### 6. Actual Behavior
Explain what ACTUALLY happens.

### 7. Severity
- [ ] Low (minor visual issue)
- [ ] Medium (affects usability)
- [ ] High (breaks functionality)
- [ ] Critical (system unusable)

### 8. Screenshot (if available)
Attach screenshot or paste link here.

---

## Issue #1 - Registration attempt outputs "Unexpected Application Error!"
### 1. Page / Location
`/login` and `/parent/dashboard`

### 2. Type of Issue
- [ ] UI Design
- [ ] UX Problem
- [x] Functional Bug
- [ ] Validation Issue
- [ ] Broken Link
- [ ] Performance Issue
- [ ] Accessibility Issue
- [ ] Other: ________

### 3. Description
When a user creates a new account on the `/login` page and clicks on "Create account", the user is taken to the `/parent/dashboard` page. However, instead of showing the parent's dashboard, an error screen appears. 
Despite this error, the newly-created account is stored on the backend MySQL Database(Name, Email, and hashed password). 

### 4. Steps to reproduce
1. Go to the `/login/` page
2. Click on `Create a new one now` button to create a new account
3. Go through the account creation process(email, confirm email, password, confirm password)
4. Click on `Create account`

### 5. Expected Behavior
What should happen is that the page should show the user's dashboard.

A new account under the name 'test' was used as an example for registration:
![registration-example](https://github.com/WinthropUniversity/project-2025-2026-pizza-tacos/blob/frontend/issuesScreenshots/Issue%20%231/registration-credentials-example.png)

However, once the user presses enter, the user will be taken to `/parent/dashboard`, which looks like this:
![create-account-button-press](https://github.com/WinthropUniversity/project-2025-2026-pizza-tacos/blob/frontend/issuesScreenshots/Issue%20%231/create-account-button-press.png)
![expected-behavior](https://github.com/WinthropUniversity/project-2025-2026-pizza-tacos/blob/frontend/issuesScreenshots/Issue%20%231/expected-behavior.png)

The newly-created account is stored on the MySQL Database on the backend though.
![registered-account-presence-on-database](https://github.com/WinthropUniversity/project-2025-2026-pizza-tacos/blob/frontend/issuesScreenshots/Issue%20%231/registered-account-on-database.png)


### 6. Actual Behavior
An Application Error message appears on `/parent/dashboard` rather than the dashboard content itself.
![actual-behavior](https://github.com/WinthropUniversity/project-2025-2026-pizza-tacos/blob/frontend/issuesScreenshots/Issue%20%231/error-screenshot.png)

### 7. Severity
- [ ] Low (minor visual issue)
- [ ] Medium (affects usability)
- [ ] High (breaks functionality)
- [x] Critical (system unusable)


## Issue #2 - User Password Change Attempt Results in "Endpoint not found" Error
### 1. Page / Location
Several types of users have the same type of error:
- `super_admin` at `/admin/settings`
- `parent` at `/parent/dashboard`

### 2. Type of Issue
- [ ] UI Design
- [ ] UX Problem
- [x] Functional Bug
- [ ] Validation Issue
- [ ] Broken Link
- [ ] Performance Issue
- [ ] Accessibility Issue
- [ ] Other: ________

### 3. Description
When a user goes to their `/settings` page and tries to change their current password to a new one, and click "Update Password", the website outputs a message on the top right with the error: "Endpoint not found"

### 4. Steps to reproduce
1. Login with a parent or admin account
2. On the dashboard, go to Settings > Security
3. Enter current password and new password
4. Click on "Update Password"

### 5. Expected Behavior
- Password should be changed with no errors(unless the original/current password was written wrong by user)
- Potentially log user out or keep logged in(taken back to dashboard).
- Change should be reflected on the Backend database(new password hash).
- Upon logout and login, the new password should allow the user to log in.

### 6. Actual Behavior
- Password change is not reflected on backend database.
- Error message "Endpoint not found" pops up as a message on top right of the screen.

### 7. Severity
- [ ] Low (minor visual issue)
- [ ] Medium (affects usability)
- [x] High (breaks functionality)
- [ ] Critical (system unusable)

### 8. Screenshots
![before-pressing-update](https://github.com/WinthropUniversity/project-2025-2026-pizza-tacos/blob/frontend/issuesScreenshots/Issue%20%232/newpassword-show.png)
![error-message](https://github.com/WinthropUniversity/project-2025-2026-pizza-tacos/blob/frontend/issuesScreenshots/Issue%20%232/error-message.png)

## Issue #3 - Enabling MFA on one account prompts MFA verification on all Parent other accounts despite MFA status
### 1. Page / Location
`/mfa-verify`

### 2. Type of Issue
- [ ] UI Design
- [ ] UX Problem
- [x] Functional Bug
- [ ] Validation Issue
- [ ] Broken Link
- [ ] Performance Issue
- [ ] Accessibility Issue
- [ ] Other: ________

### 3. Description
When a user sets up 2FA on their account, logs out, and tries to log back in

### 4. Steps to Reproduce
1. Login as a parent
2. Go to Profile and click on Enable 2FA
3. Go through the 2FA setup process(write key or use QR code on Authenticator App(like Google Authenticator)
4. Once 2FA is enabled on current account, log/sign out, and login as another user or create a new account(registration)

- Even if you login as a user who doesn't have 2FA enabled, the login screen will redirect you to `/mfa-verify`
- Even if you create a new account(which has 2FA disabled by default), the login screen will redirect you to `/mfa-verify`


### 5. Expected Behavior
A new user or current user who doesn't have 2FA enabled should log in using only their username and password, thus redirecting them to `/parent/dashboard`
NOTE: This has been tested on the super admin account and the super account can still be logged onto without the 2FA `/mfa-verify` being prompted(redirects to `/super-admin/dashboard`

NOTE: This has not been tested on the admin account.

### 6. Actual Behavior
A new user or current user who doesn't have 2FA enabled gets prompted for a 6-digit code on `/mfa-verify` after entering username and password on `/login`. That is, after entering their credentials on `/login`, the user gets redirected to `/mfa-verify` to insert a 6-digit code.

### 7. Severity
- [ ] Low (minor visual issue)
- [ ] Medium (affects usability)
- [ ] High (breaks functionality)
- [x] Critical (system unusable)

### 8. Screenshot (if available)
![account-with-2fa](https://github.com/WinthropUniversity/project-2025-2026-pizza-tacos/blob/frontend/issuesScreenshots/Issue%20%233/account-with-2fa.png)
![account-without-2fa](https://github.com/WinthropUniversity/project-2025-2026-pizza-tacos/blob/frontend/issuesScreenshots/Issue%20%233/account-without-2fa-login.png)
![error-screenshot](https://github.com/WinthropUniversity/project-2025-2026-pizza-tacos/blob/frontend/issuesScreenshots/Issue%20%233/error-screenshot.png)

## Issue #4 - Unable to Disable MFA
### 1. Page / Location


## Issue #5 - Missing QR Code on 2FA Setup
### 1. Page / Location
Example: Login Page / Dashboard / Registration Form

### 2. Type of Issue
- [ ] UI Design
- [ ] UX Problem
- [ ] Functional Bug
- [ ] Validation Issue
- [ ] Broken Link
- [ ] Performance Issue
- [ ] Accessibility Issue
- [ ] Other: ________

### 3. Description
Clearly describe what is wrong.

### 4. Steps to Reproduce
1. Go to ___
2. Click ___
3. Enter ___
4. Observe ___

### 5. Expected Behavior
Explain what SHOULD happen.

### 6. Actual Behavior
Explain what ACTUALLY happens.

### 7. Severity
- [ ] Low (minor visual issue)
- [ ] Medium (affects usability)
- [ ] High (breaks functionality)
- [ ] Critical (system unusable)

### 8. Screenshot (if available)
Attach screenshot or paste link here.



