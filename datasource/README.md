# Evidence Simple Analytics Connector

This package allows for importing your data VIA the Simple Analytics API directly into Evidence.


## Installing

1. Install the package

```bash
npm install evidence-connector-simple-analytics
```

2. Add the datasource to your evidence.plugins.yaml

```json
datasources:
  "evidence-connector-simple-analytics": {}
```

3. Start the development server, navigate to localhost:3000/settings and add a new datasource. You should see "simple-analytics" as an option.


## Loading Data into Evidence

1. Obtain your unique Simple Analytics API Key and UserID and input it through the settings interface
and press 'Confirm Changes'

2. Now in your Evidence project in VSCode locate your 'connection.yaml' file for the connector under sources

```
-- myEvidenceProject
  -- sources
    -- name_of_your_simple_analytics_connector
      -- connection.yaml
```

3. Within your connection.yaml specific the tables you want with the URL and staring/end dates for your
data pull (Ensure you use the CSV format link when getting your API URL from Simple Analytics)

```
name: name_of_your_simple_analytics_connector
type: simple-analytics
options: {}
exports:
  myTable1:
    URL: 'Table1URL'
    StartDate: '2024-01-01'
    EndDate: '2024-07-22'
  myTable2:
    URL: 'Table2URL'
    StartDate: '2024-02-01'
    EndDate: '2024-08-22'
```

4. Save the connections.yaml file and 'npm run sources' in your terminal to load in your tables
