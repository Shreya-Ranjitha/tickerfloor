# TickerFloor

### Live Automation Exchange

TickerFloor is a high-performance client-side telemetry visualization platform designed to simulate a real-time automation exchange.

The system ingests a **50,000-row automation dataset**, streams updates continuously, and provides efficient exploration through custom virtualization, analytics, filtering, inspection tools, and snapshot capabilities.

---

## Features

### KPI Dashboard

Displays real-time operational metrics:

* Total Streamed Rows Processed
* Active Robots Deployed Count
* Global Cumulative Savings

---

### Live Streaming Engine

Simulates a continuously updating automation exchange.

Features include:

* 200 ms update cadence
* incremental telemetry ingestion
* buffered updates during pause state
* stable rendering under continuous load

---

### Custom Virtualized Grid

Built entirely from scratch without third-party virtualization libraries.

Capabilities:

* row recycling
* translateY positioning
* constant DOM complexity
* minimal repaint cost
* efficient rendering for large datasets

Dataset size:

```text
50,000 projects
```

Rendered rows:

```text
~24 rows visible at any time
```

---

### Filtering System

Supports dynamic filtering across multiple dimensions.

Available filters:

* Status
* Asset Class
* Sector
* Exchange

Features:

* multi-select dropdowns
* instant filtering
* live aggregation updates

---

### Fuzzy Search

Searches simultaneously across multiple project attributes.

Examples:

```text
India
Automation
Process Mining
Customer Onboarding
```

---

### Sorting

Supports:

* single-column sorting
* multi-column sorting
* stable ordering during live updates

Columns remain sorted while new telemetry arrives.

---

### Pause / Resume Pipeline

TickerFloor can freeze the viewport while maintaining data ingestion.

During pause:

* UI rendering halts
* stream processing continues
* updates are queued

Upon resume:

* queued updates flush immediately
* no data is lost

---

### Analytics View

Provides aggregated insights derived from the filtered dataset.

Includes:

* status distributions
* deployment summaries
* savings analysis
* ROI distributions
* categorical breakdowns

Charts are rendered using Chart.js.

Analytics operate on filtered results only.

---

### Row Inspector

When the market is halted, selecting a project opens a detailed inspector panel.

Inspector contents include:

* Project metadata
* Company identifiers
* Financial metrics
* Deployment information
* Timeline information
* Geographic information
* Operational attributes

---

### Snapshot Export

Exports the current dashboard state.

Preserves:

* active filters
* search state
* sorting order
* visible dataset

Entirely client-side.

---

## Architecture

```text
tickerfloor/

├── index.html
├── style.css
├── automation_projects.csv
├── dataStream.js

├── vendor/
│   └── chart.umd.js

└── src/

    ├── data/
    │   ├── csvLoader.js
    │   └── streamAdapter.js

    ├── grid/
    │   ├── virtualGrid.js
    │   ├── sorter.js
    │   └── filterEngine.js

    ├── state/
    │   ├── store.js
    │   └── renderScheduler.js

    └── features/
        ├── analyticsView.js
        ├── alertFlash.js
        ├── kpiBar.js
        ├── layoutPersistence.js
        ├── multiSelectFilter.js
        ├── pauseControl.js
        ├── rowInspector.js
        └── snapshotExport.js
```

---

## Dataset Schema

The platform operates on a telemetry dataset containing:

```text
project_id
company_id
project_name
project_status
automation_type
robots_deployed
budget_usd
annual_savings_usd
roi_percent
department
industry
country
implementation_partner
employee_hours_saved
ai_enabled
cloud_deployment
start_date
completion_date
```

---

## Performance Characteristics

Validated with:

```text
50,000 rows
200 ms update intervals
```

Typical runtime metrics:

```text
Rendered Rows      ≈ 24
DOM Elements       ≈ 1,200
Heap Usage         ≈ 100 MB
```

Rendering complexity remains effectively constant regardless of dataset size.

---

## Technology Stack

* HTML5
* CSS3
* Vanilla JavaScript
* Chart.js
* LocalStorage
* CSV-based ingestion

No backend services required.

No external virtualization libraries used.

---

## Running Locally

Clone the repository.

Start a local server:

```bash
python -m http.server 8000
```

or

```bash
npx serve .
```

Open:

```text
http://localhost:8000
```

---

## Key Capabilities

✔ 50,000 project virtualization

✔ Real-time telemetry simulation

✔ Multi-dimensional filtering

✔ Fuzzy search

✔ Stable sorting

✔ Pause and buffered resume

✔ Analytics dashboard

✔ Project inspector

✔ Snapshot export

✔ Memory-efficient rendering

✔ Constant DOM footprint

---

Developed as part of a high-performance telemetry visualization challenge.
