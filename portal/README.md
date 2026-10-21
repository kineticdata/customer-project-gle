# Momentum Portal - Front End Code

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![@KineticData KineticData](https://img.shields.io/badge/GitHub%20-KineticData-lightgrey.svg?style=flat-square)](https://github.com/kineticdata/momentum-portal)

The Momentum Portal is a fully-functional demo that brings the capabilities of the Kinetic Experience Platform to life. This codebase implements the Momentum Portal.

## Table of Contents

- [Quick Start](#quick-start)
- [Included Libraries](#included-libraries)
- [Project Structure](#project-structure)
- [Documentation](#documentation)

## Quick Start

### Clone the Repository

```
git clone https://github.com/kineticdata/momentum-portal
```

The front end code can be found in the `portal` directory of the repo.

### Install Dependencies

```bash
# make sure you are in the `portal` directory
$ yarn install
```

Requires `node` `v18` or later, and `yarn` `v1`.

### Start Local Dev Server

```bash
# starts the dev server with hot reload at http://localhost:3000
$ yarn start
```

The first time you run the above command, you will be prompted to enter a URL to a Kinetic Platform server, which the dev server will proxy to. This URL will be stores in the `.env.development.local` file and can later be changed there.

The local server will be available at [http://localhost:3000](http://localhost:3000). Changes to source files will update automatically.

### Create Production Build

```bash
# build for production with minification
$ yarn build
```

The build artifacts will be stored in the `build/` directory.

## Included Libraries

The following list summarizes the different libraries that have been used to create this project.

[Vite](https://vite.dev/): Build tooling for the project.  
[React](https://react.dev/): Framework for building out the application.  
[React Router](https://reactrouter.com/en/main): Routing library.  
[Redux Toolkit](https://redux-toolkit.js.org/) + [ReactRedux](https://react-redux.js.org/): Global state storage.  
[Ark UI](https://ark-ui.com/): Headless component library.  
[Tailwind CSS](https://tailwindcss.com/): Utility-first CSS framework.  
[Tabler Icons](https://tabler.io/icons): Icon library.  
[@kineticdata/react](https://components.kineticdata.com/apis): Kinetic API helpers, authentication, form rendering, and i18n.  
[date-fns](https://date-fns.org/): Date utility library.  
[immer](https://immerjs.github.io/immer/): Immutable data helper.  
[clsx](https://github.com/lukeed/clsx): Class name helper.

## Project Structure

```
momentum-portal/portal
├── src/                    # project source code
│   ├── assets/             # static assets (e.g. styles, fonts)
│   ├── atoms/              # design system components
│   ├── components/         # components used by pages
│   ├── helpers/            # helper functions
│   ├── pages/              # pages within the app
│   │
│   ├── App.js              # app renderer
│   ├── index.js            # javascript root
│   ├── redux.js            # redux toolkit setup
│   └── setupEnv.cjs        # prestart script to set up local env file
│
├── .env.development        # dev environment variables
├── .env.development.local  # local dev environment variables
├── .env.production         # prod environment variables
├── index.html              # html root
├── package.json
├── postcss.config.js       # postcss config used by tailwind
├── tailwind.config.js      # tailwind config
├── vite.config.mjs         # vite config
└── yarn.lock               # dependency lock file - DO NOT EDIT OR DELETE
```

## Documentation

[Kinetic Widgets Documentation &#x2B9E;](src/components/kinetic-form/widgets/README.md)

See the [Kinetic Data Documentation Library](https://docs.kineticdata.com/) for more information.

## Portal S3 Deployment

The Momentum Portal code is published to an S3 bucket. The base URL is: `https://s3.amazonaws.com/kinetic-portals/portals/momentum-portal/`

Publishes are split into two channels so consumers can choose how aggressively they pick up changes:

- **`versions/`** — produced by tag pushes. A real release tag (e.g. `v6.1.8`) fans out to three destinations so a space can pin to whichever granularity it wants: the exact version, the minor line, or the major line. Pre-release tags (e.g. `v6.1.8-rc2`) publish **only** to their exact-version destination so they cannot bump a major or minor line that production spaces follow.
- **`branches/`** — produced by commits to protected branches (`main` and any `epic/**` branch). A branch tip is meant for development/QA spaces, not production.

| Github Event                | Destination Directory                                                                   | Github Action Workflow File   | Example Usage                                  |
| --------------------------- | --------------------------------------------------------------------------------------- | ----------------------------- | ---------------------------------------------- |
| Tag Push (release)          | `versions/XX.YY.ZZ/` **and** `versions/XX.YY.x/` **and** `versions/XX.x.x/`             | portal-tag-push.yaml          | Releasing a tagged version.                    |
| Tag Push (pre-release)      | `versions/XX.YY.ZZ-suffix/` (exact only — does not bump the minor or major lines)       | portal-tag-push.yaml          | Publishing a release candidate or build tag.   |
| Commit to Protected Branch  | `branches/<branch-name>/` (e.g. `branches/main/`, `branches/epic/spring-boot/`)         | portal-branch-push.yaml       | Testing the tip of `main` or an epic branch.   |
| Run Dispatch Workflow       | `versions/YYYYMMDD-abcd1234/`                                                           | portal-build-dispatch.yaml    | Testing code on a particular branch or commit. |

Example URLs for the different channels:

- Branch tip (bleeding edge): `https://s3.amazonaws.com/kinetic-portals/portals/momentum-portal/branches/main/`
- Major line (stable, recommended for production): `https://s3.amazonaws.com/kinetic-portals/portals/momentum-portal/versions/6.x.x/`
- Pinned release: `https://s3.amazonaws.com/kinetic-portals/portals/momentum-portal/versions/6.1.8/`

You can also view the output to determine the S3 bucket by viewing the Github Action workflow run.

[github_actions_directory](../.github/workflows/)

### License

Code released under [the MIT license](https://github.com/coreui/coreui-free-react-admin-template/blob/main/LICENSE).
