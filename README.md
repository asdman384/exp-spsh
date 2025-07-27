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
Run `ng test` to execute the unit tests via [Karma](https://karma-runner.github.io).

## Running end-to-end tests
Run `ng e2e` to execute the end-to-end tests via a platform of your choice. To use this command, you need to first add a package that implements end-to-end testing capabilities.F