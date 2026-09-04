# ExpSpsh

expenses app

Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
Set-ExecutionPolicy Restricted

## 1 Build
- fill in keys.json
- Run `npx npm run watch` to build the project. The build artifacts will be stored in the `dist/` directory.


## 2 Development server
Run `npx npm run serve` for a dev server. Navigate to `http://localhost:4200/exp-spsh/`. The application will not automatically reload if you change any of the source files.


## Running unit tests
Run `npm test` to execute the unit tests with Angular's Vitest runner in headless Chromium.
Run `npm run test:headed` to run the tests in watch mode.

## Running end-to-end tests
End-to-end testing is not configured in this project.