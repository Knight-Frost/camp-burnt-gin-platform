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

## Issue #3 - Enabling MFA on one account enables it on all accounts. 
### 1. Page / Location


## Issue #4 - Disabling MFA 
### 1. Page / Location

