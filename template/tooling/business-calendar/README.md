# Business Calendar

Business-day and business-hours calculations for workflows and the portal:
- add a duration in business days, calendar days, weeks or business hours
- check whether a date is a business day, or a moment is within business hours
- find the next or previous business day, or the next business opening
- count business days, or business hours, between two dates

Nothing here is onboarding-specific.

## What's on the platform

| Item | Name |
|---|---|
| Datastore forms (service-portal) | `business-calendar`, `business-calendar-exception` |
| Kapp security policy | Business Calendar Admins (space admins and the Human Resources team) |
| Integrator operation | Search Submissions, on the Kinetic Platform connection |
| Core routine | Business Calendar Calculate (`routine_business_calendar_calculate_v1`) |
| Wrapper routines | Business Calendar Add Duration, Is Business Day, Next Business Day, Previous Business Day, Business Days Between, Business Hours Between, Is Within Business Hours, Next Business Opening |
| Batch routine | Business Calendar Add Duration Batch (`routine_business_calendar_add_duration_batch_v1`) |
| WebAPI | `GET /app/kapps/service-portal/webApis/business-calendar?timeout=10` (Authenticated Users) |
| Batch WebAPI | `POST /app/kapps/service-portal/webApis/business-calendar-batch?timeout=25` (Authenticated Users) |
| Portal helper | `businessCalendar(kappSlug, params)` in `portal/src/helpers/api.js` |

HR maintains calendars and exceptions under Settings > Datastore. Each
exception's Calendar field stores the calendar's submission ID, so calendars
can be renamed safely. Submission IDs differ between spaces, so workflows should
read a calendar ID from data (or pass blank for the default) rather than
hardcode one.

## One implementation

`business_calendar.rb` is the only place the date logic lives. `build_trees.rb`
embeds it in the core routine's Plan and Calculate nodes. The wrapper routines
and the WebAPI only call the core routine, and the portal only calls the
WebAPI.

The core routine:

1. Lists all calendars (Search Submissions, no query), then resolves the
   requested ID or falls back to the default.
2. Validates the inputs and works out the date range the calculation can
   touch.
3. Fetches that range's exceptions in a single indexed search
   (`values[Calendar],values[Date]`).
4. Calculates the result.

## Batch

`Business Calendar Add Duration Batch` runs many add_duration calculations in
one routine run. It searches the calendars once and the exceptions once (one
`values[Calendar] IN (...) AND values[Date] BETWEEN (...)` search covering every
request), then calculates every date in one node. `batch.rb` holds the batch
logic; each date still goes through `BizCal.plan` and `BizCal.calculate`, so it
matches Business Calendar Add Duration for the same inputs.

- **Input `Requests`:** a JSON array (at most 1000) of
  `{id, calendar, fromDate, amount, unit, direction, adjust, time, dependsOn}`.
  - `calendar` is a calendar Name (any letter case) or ID. Blank uses the
    default. An unknown calendar is an error for that request only; Add
    Duration would fall back to the default instead.
  - `fromDate`, `amount`, `unit`, `direction`, `adjust` and `time` mean what
    the Add Duration inputs mean.
  - `dependsOn` is another request's id. When `fromDate` is blank, that
    request's result datetime is the From Date (a warning date counted back
    from a due date). Chains work in any order.
- **Output `Dates`:** a JSON object keyed by request id, each value
  `{date, datetime}` (datetime in UTC) or `{error}`. Request errors read
  `CODE: message` for calendar errors, or one of: `Unknown calendar "X"`,
  `The request has no from date`, `Depends on X, which failed`,
  `Depends on X, which was not requested`,
  `Depends on X, but the dependencies form a loop`,
  `More than one request has this id`. Requests without an id are skipped.
- **`Error Count`** counts the requests in `Dates` with an error.
  **`Error Code`** / **`Error Message`** are set only when the batch as a whole
  fails (Requests isn't a JSON array of objects, more than 1000 requests, or
  the calendar search failed); `Dates` is then `{}` and `Error Count` is 1.
- **WebAPI:** `POST` with body `{"requests": [...]}`. Returns 200 with
  `{"dates": {...}, "errorCount": n}`, or 400 with
  `{"error": {"code", "message"}}` for a bad body or a batch-level error.

On global-laser-enrichment-dev (2026-10-22) the routine took about 2 seconds for
1000 requests, and the WebAPI answered in about 9 seconds.

## Semantics

- **Business day:** a Working Day Override date, or a working weekday that
  isn't a Holiday or Closure. Holiday and Closure only differ for reporting.
- **Business-day offsets:** the start date is never counted, so Fri + 1 = Mon
  and Sat + 1 = Mon. A negative amount reverses the direction.
- **`adjust`** (none / previous_business_day / next_business_day): applied to
  the final result. It only matters for calendar days, weeks, or a business-day
  amount of 0. Offset 0 on a holiday with `adjust=none` returns the same date.
- **Weeks:** 7 calendar days.
- **Next / previous business day:** always strictly after / before the date.
- **Business days between (start, end):** counts business days after start, up
  to and including end. It's negative if end is before start, and it's the
  inverse of adding business days.
- **Calendar selection:**
  - A blank calendar uses the default.
  - An unknown ID uses the default with the warning
    `CALENDAR_NOT_FOUND_USED_DEFAULT` and `fallback: true`.
  - Zero defaults gives `NO_CALENDAR`; more than one gives `AMBIGUOUS_DEFAULT`.
- **Dates and datetimes:**
  - Dates are `YYYY-MM-DD` in the calendar's time zone.
  - An ISO 8601 datetime input (with an offset) is converted to that time zone
    first. Business-day operations then use only its date.
  - Every datetime result comes two ways:
    - `datetime` (`Result Datetime`) in ISO 8601 UTC
    - `datetimeLocal` (`Result Datetime Local`) in the calendar's time zone with
      its offset, e.g. `2026-11-19T08:00:00-06:00`
  - Business-day results are stamped at the Default Activation Hour (or
    `time`). Daylight saving is handled.

### Business hours

- **Working hours:** each calendar has one Work Start to Work End window
  (`HH:MM`).
  - It applies to every business day, including Working Day Overrides.
  - There are no breaks, no half-day exceptions and no overnight hours (Start
    must be before End).
  - Calendars without hours still work for business-day operations. Hours
    operations on them return `CALENDAR_INVALID`.
- **Wall-clock time:** times are local to the calendar's time zone, to the
  minute (seconds are dropped). Daylight-saving changes happen outside normal
  working hours, so a working day is always Work End minus Work Start.
- **A date alone** in an hours operation means that day's opening (Work Start).
- **Adding hours** (`unit=business_hours`):
  - The amount can be fractional (1.5 = 90 minutes) and is counted in whole
    minutes. The limit is 10,000 hours.
  - A start outside working hours first rolls forward to the next opening.
  - Time is then consumed day by day.
  - Landing exactly on closing time returns closing time that day; 16:00 + 1h
    = 17:00, not 08:00 the next day.
  - `adjust` is ignored for this unit.
- **Subtracting hours** (`direction=before`, or a negative amount) mirrors
  this. A start outside working hours rolls back to the previous closing, so
  4h before Monday 07:00 is Friday 13:00 (on a normal week).
- **Business hours between (start, end):**
  - Counts only working time: the part of each business day inside working
    hours.
  - Returns `minutes` and `hours` (2 decimal places), negative if end is before
    start.
- **Is within business hours:** opening time counts as open and closing time
  doesn't.
  - Reasons: `open`, `before_open` or `after_close`, or the day's reason
    (`weekend`, `holiday`, `closure`, `non_working_day`).
- **Next business opening:**
  - The given moment itself if business is already open (`alreadyOpen: true`).
  - Otherwise the next Work Start on a business day.
- **Business days are unchanged.** `business_days` stays date-only; the time
  of day doesn't create a cutoff.

### Guards

- Amount limits: 2600 business days, 3660 calendar days, 520 weeks, 10,000
  business hours (`LIMIT_EXCEEDED`).
- At most 4000 day steps (`ITERATION_LIMIT`).
- Walking past the fetched exceptions gives `WINDOW_EXCEEDED`.

### Errors

- Routines never raise. Callers branch on `Error Code` being blank.
- The WebAPI returns 400 for bad input and 500 for configuration problems,
  with body `{ "error": { "code", "message" } }`.

## WebAPI parameters

`op` plus:

| `op` | Parameters |
|---|---|
| `add_duration` | `from`, `amount`, `unit`, `direction`, `adjust`, `time` |
| `is_business_day` | `date` |
| `next_business_day`, `previous_business_day` | `date`, `time` |
| `business_days_between` | `start`, `end` |
| `business_hours_between` | `start`, `end` |
| `is_business_time` | `date` |
| `next_business_opening` | `date` (or `from`) |

Every operation also accepts `calendar`.

Example: `?timeout=10&op=add_duration&from=2026-11-30&amount=5&unit=business_days&direction=before`
returns:

```json
{"operation":"add_duration","calendar":{"id":"...","name":"GLE US","timeZone":"America/Chicago","fallback":false},
 "result":{"date":"2026-11-19","datetime":"2026-11-19T14:00:00Z","isBusinessDay":true},"warnings":[]}
```

## Changing the logic

```bash
cd template/tooling/business-calendar
ruby test_local.rb
ruby test_batch_local.rb
ruby build_trees.rb <search-submissions-operation-id> /tmp/business-calendar-build --export ../../export
```

1. Edit `business_calendar.rb` (or `batch.rb`), then run `ruby test_local.rb`
   and `ruby test_batch_local.rb`. They run `cases.json` and
   `batch_cases.json` locally, using the TZ-based time zone stubs in
   `local_fixture.rb` because MRI has no `java.time`. `test_batch_local.rb`
   also checks each batch result against the same request calculated on its
   own.
2. Rebuild with `build_trees.rb`. It writes the API payloads to the build
   directory. With `--export`, it also rewrites the routine and WebAPI tree XML
   in `template/export` exactly as the Task engine exports them.
3. Update the routines and WebAPI tree on the platform:
   - Routines: `PUT /trees/{title}` with the new `treeJson` and current
     `versionId`.
   - WebAPIs: `POST /kapps/service-portal/webApiImport?force=true`.
4. Re-run the cases against the platform. For the batch, run
   `batch_cases.json` as one batch routine run, run Business Calendar Add
   Duration for every request it can also run, and compare with
   `BatchCompare.check` in `batch_compare.rb`.

The embedded module is named after a hash of the source, so a routine update
never collides with an older version already loaded in the engine.

**Known engine issue (Task 7.0.0-rc4).** About 3 runs in 100 failed under
concurrent load before any node ran. The **Start** node failed with
`org.hibernate.exception.GenericJDBCException: This statement has been closed`
(a PostgreSQL connection-pool error), so:
- WebAPI callers got a 500 or `run_results_timeout`.
- A calling workflow is left with a stalled routine run and an "Unidentified
  Error" in the Task error queue. Retry it from there.

This is outside the module, and the same request succeeds when sent again.

### Tree conventions

- **Every node parameter is labeled.**
  - The engine accepts a parameter with only `id` and `value`, but the workflow
    builder then shows an unlabeled input box, so nobody can tell which value
    feeds which input or routine output. The export also shows
    `required="null"`.
  - `build_trees.rb` gives every parameter the metadata the Console sets:
    `label`, `required`, `description` (shown as the tooltip), `menu`,
    `dependsOnId` and `dependsOnValue`. It refuses to build a node with a blank
    label.
  - Labels follow the Console:

    | Node type | Labels |
    |---|---|
    | Echo | `Input` |
    | system_integration_v1 | `Connection ID` and `Operation ID`, plus each operation input's name |
    | Routine call | Each routine input's name, required flag and description |
    | Routine Return | Each output's name |
    | WebAPI Return | `Content`, `Content Type`, `Headers (JSON)`, `Response Code` |

- **Code in nodes is commented and indented, never minified.** People review
  and edit these trees in the workflow builder, so:
  - The library is embedded verbatim with its comments, under a header that
    names the source file.
  - Every ERB value longer than a lookup starts with a comment saying what it
    returns. Each Return output, for example, opens with
    `# <Output>: <description>`.
  - Connector conditions are plain Ruby, such as
    `JSON.parse(@results['Plan']['output'])['ok'] == true`, under a label like
    "Plan OK?".
  - Keep `business_calendar.rb` and `request_params.rb` commented the same way.
- **Saving a tree in the workflow builder can reformat code parameters.**
  Opening and saving the WebAPI tree once re-indented the embedded Ruby. That's
  harmless to Ruby, but it makes the platform drift from the build. Treat
  `build_trees.rb` as the source, and rebuild and re-push after editing in the
  builder.
- **Node positions in the build match the layout chosen in the builder.**
  Update them in `build_trees.rb` if you rearrange a tree there.

## Testing on a space

The cases in `cases.json` use a fixture calendar, **ZZ Test US**
(America/Chicago, Mon-Fri, activation 08:00, hours 08:00-17:00), with these
exceptions:

- 2026-11-26: Holiday
- 2026-11-27: Closure
- 2026-12-19: Working Day Override
- 2026-12-25: Holiday
- 2027-01-01: Holiday

The space also needs a default calendar. Run each case as a WebAPI call with
`calendar=TEST` replaced by the fixture's submission ID.

As of 2026-10-20 on global-laser-enrichment-dev, all 79 cases pass through the
WebAPI, run one at a time, and each new business-hours wrapper routine returns
the expected outputs. The unique exception index also rejects a duplicate
calendar and date.

## Not included yet

- Calendars and holidays aren't exported or installed. Records aren't part of
  the template, so each space needs its calendars entered.
- A "copy holidays to next year" helper. Floating holidays such as Thanksgiving
  can't be copied by date, so a Recurrence (Fixed / Floating) field would help
  first.
