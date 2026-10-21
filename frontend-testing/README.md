# Momentum Portal - Frontend Testing

Tests for Momentum Portal using [Playwright](https://playwright.dev/).

# Setup Recommendations

- Use VS Code for test development
- Use VS Code plugin "Playwright Test for VS Code" to manually run tests. The plugin can be added to VS Code from the Extensions tab.
  - The playwright tests requires node_module to be installed. The installation can be done using the VS Code command pallet
    - Open frontend-testing as a folder in the Workspace (it is important that frontend-testing be the root folder in the workspace)
    - Open command pallet Mac (cmd+shft+p) Windows (ctrl+shft+p)
    - Type "Install Playwright" in the command pallet and select.

### 1. Install Dependencies

Navigate to the `frontend-testing` directory and install dependencies:

```bash
cd frontend-testing
yarn install
```

### 2. Configure Environment Variables

Create a `.env` file in the `frontend-testing` directory:
Add your test environment credentials:

```env
PW_BASE_URI=https://momentum-dev.kinopsdev.io
PW_SPACE_URI=https://momentum-dev.kinopsdev.io
PW_USERNAME=username
PW_PASSWORD=password
```

**Important:** The `.env` file is gitignored. Never commit credentials to version control.

### Password policy and banner tests (Kinetic Platform 7.0)

`passwordChange`, `passwordChangeTimeout`, `resetPassword`, `loginBanner` and `environmentBanner` need a Kinetic Platform 7.0 space. They create (and delete) test users and temporarily change the space's login banner, Environment Banner and minimum password length, restoring them afterwards, as the space admin in `PW_USERNAME` / `PW_PASSWORD`.

They are skipped unless you allow that:

```env
PW_SPACE_CHANGES_ALLOWED=true
```

Only set it for a space where such changes are acceptable, never for a shared environment.

## Running Tests

### Run All Tests

- After installing the Playwright Test plugin a flask icon should appear on the left side of VS Code
- To run the tests first choose the flask icon. If everything is set up correctly there should be "tests" in the TEST EXPLORER on the left side of VS Code.
- All tests, a file of test suites, a suite of tests, or individual tests can be run.

## Writing Tests

### Basic Test Structure

Create a new test file in `frontend-testing/tests/` with the `.spec.ts` extension:

```typescript
import test, { expect } from "@playwright/test";
import { TEST_HOST } from "./constants";
import { login } from "./helpers";

test.describe("Feature Name", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("should do something", async ({ page }) => {
    // Navigate to a page
    await page.goto(`${TEST_HOST}/#/some-route`);

    // Interact with elements
    await page.locator('button:has-text("Click Me")').click();

    // Assert expected behavior
    await expect(page.locator(".success-message")).toBeVisible();
  });
});
```

## Project Structure

```
frontend-testing/
├── tests/
│   ├── auth.spec.ts           # Authentication tests
│   └── sidebarMenu.spec.ts    # Sidebar navigation tests
├── constants.ts               # Environment variables and shared constants
├── helpers.ts                 # Reusable test helper functions
├── .env                       # Environment configuration (gitignored)
├── .gitignore                 # Git ignore rules
├── package.json               # Dependencies and scripts
├── playwright.config.ts       # Playwright configuration
└── yarn.lock                  # Yarn dependency lock file
```
