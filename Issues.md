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
- [ ] Functional Bug
- [ ] Validation Issue
- [ ] Broken Link
- [ ] Performance Issue
- [x] Accessibility Issue
- [ ] Other: ________

### 3. Description
When a user creates a new account on the `/login` page and clicks on "Create account", the user is taken to the `/parent/dashboard` page. However, instead of showing the parent's dashboard, an error screen appears. 
Despite this error, the newly-created account is stored on the backend MySQL Database(Name, Email, and hashed password). 


### 5. Expected Behavior
What should happen is that the page should show the user's dashboard.
![expected-behavior](https://github.com/WinthropUniversity/project-2025-2026-pizza-tacos/blob/frontend/issuesScreenshots/Issue%20%231/expected-behavior.png)


### 6. Actual Behavior
An Application Error message appears on `/parent/dashboard` rather than the dashboard content itself.
![actual-behavior](https://github.com/WinthropUniversity/project-2025-2026-pizza-tacos/blob/frontend/issuesScreenshots/Issue%20%231/error-screenshot.png)

### 7. Severity
- [ ] Low (minor visual issue)
- [ ] Medium (affects usability)
- [ ] High (breaks functionality)
- [x] Critical (system unusable)

