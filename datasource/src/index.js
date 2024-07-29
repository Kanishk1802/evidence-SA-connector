import { default as axios } from "axios";
import { parse } from "csv-parse/browser/esm";
import { EvidenceType, TypeFidelity } from "@evidence-dev/db-commons";
import { temporaryFile } from "tempy";
import yaml from "js-yaml";
import fs from "fs";


/**
 * @typedef {Object} ConnectorOptions
 * @property {string} UserID - The user ID for the API.
 * @property {string} apiKey - The API key for the API.
 */
export const options = {
  UserID: {
    title: "User Id",
    type: "string",
    description: "Simple Analytics UserID",
    required: true,
    secret: true,
  },
  apiKey: {
    title: "API Key",
    type: "string",
    description: "Simple Analytics API Key",
    required: true,
    secret: true,
  },
  
};

export default { options };


/** @type {import("@evidence-dev/db-commons").getRunner<ConnectorOptions>} */
export const getRunner = () => {
  throw new Error(
    "Simple Analytics connector does not support getRunner."
  );
};

/**
 * @type {import("@evidence-dev/db-commons").ProcessSource<ConnectorOptions>}
 */
export async function* processSource(options, sourceFiles, utilFuncs) {
  const { UserID, apiKey } = options;
  if (!("connection.yaml" in sourceFiles)) {
    throw new Error("connection.yaml is missing; this is odd");
  }
  if (typeof sourceFiles["connection.yaml"] !== "function") {
    throw new Error("connection.yaml is a directory; this is odd");
  }

  const connYaml = await sourceFiles["connection.yaml"]();
  const { exports } = yaml.load(connYaml);

  for (const [tableName, exportObj] of Object.entries(exports)) {
    let { URL: apiUrl, StartDate, EndDate } = exportObj;

    // Parse the existing URL
    const urlObj = new URL(apiUrl);
    const params = new URLSearchParams(urlObj.search);

    // Update the start and end dates
    if (StartDate) {
      params.set('start', StartDate);
    } else {
      params.delete('start');
    }
    if (EndDate) {
      params.set('end', EndDate);
    } else {
      params.delete('end');
    }
    urlObj.search = params.toString();
    apiUrl = urlObj.toString();

    try {
      const response = await axios.get(apiUrl, {
        headers: {
          'User-Id': UserID,
          'Api-Key': apiKey
        }
      });

      let data = response.data;
      // Check if the data is a CSV string
      if (typeof data === 'string') {
        data = await new Promise((resolve, reject) => {
          parse(data, {
            columns: true,
            skip_empty_lines: true
          }, (err, output) => {
            if (err) {
              reject(err);
            } else {
              resolve(output);
            }
          });
        });
      }
      if (!Array.isArray(data)) {
        throw new Error('API response is not an array or valid CSV');
      }

      if (data.length === 0) {
        throw new Error('No data returned from the API');
      }

      // Infer column types by checking all non-null values
      const columnTypes = {};
      for (const row of data) {
        for (const [key, value] of Object.entries(row)) {
          if (value !== null && value !== undefined) {
            const evidenceType = inferValueType(value);
            if (!columnTypes[key] || columnTypes[key] === EvidenceType.STRING) {
              columnTypes[key] = evidenceType;
            }
          }
        }
      }

      const rows = data.map((row) => {
        const transformedRow = {};
        for (const [key, value] of Object.entries(row)) {
          let parsedValue = value;
          if (columnTypes[key] === EvidenceType.NUMBER) {
            parsedValue = Number(value);
          } else if (columnTypes[key] === EvidenceType.BOOLEAN) {
            parsedValue = value.toLowerCase() === 'true';
          } else if (columnTypes[key] === EvidenceType.DATE) {
            parsedValue = new Date(value);
          }
          transformedRow[key.toLowerCase()] = parsedValue;
        }
        return transformedRow;
      });

      const columnTypesArray = Object.keys(columnTypes).map((key) => ({
        name: key.toLowerCase(),
        evidenceType: columnTypes[key],
        typeFidelity: 'inferred',
      }));

      yield {
        rows: rows,
        columnTypes: columnTypesArray,
        expectedRowCount: rows.length,
        name: tableName,
        content: JSON.stringify(options),
      };
    } catch (error) {
      console.error(`Error fetching data for ${tableName}:`, error.message);
      console.error(`Full error details:`, error);
      throw new Error(`Failed to fetch data for ${tableName}: ${error.message}`);
    }
  }
}




function inferValueType(columnValue) {
  if (columnValue === null || columnValue === undefined) {
    return EvidenceType.STRING; // Default to STRING for null/undefined
  } else if (typeof columnValue === 'number' && !isNaN(columnValue)) {
    return EvidenceType.NUMBER;
  } else if (typeof columnValue === 'boolean') {
    return EvidenceType.BOOLEAN;
  } else if (typeof columnValue === 'string') {
    // Check if the string represents a boolean
    if (columnValue.toLowerCase() === 'true' || columnValue.toLowerCase() === 'false') {
      return EvidenceType.BOOLEAN;
    }
    // Check if the string represents a number
    if (!isNaN(Number(columnValue)) && !isNaN(parseFloat(columnValue))) {
      // Ensure that we are not treating a number-like string as a number
      // For example, check if the string has a leading zero or other non-numeric characters
      if (!/^0[0-9]+$/.test(columnValue) && /^[+-]?(\d*\.)?\d+$/.test(columnValue)) {
        return EvidenceType.NUMBER;
      }
    }
    // Check if the string represents a date
    if (columnValue && (columnValue.match(/-/g) || []).length === 2) {
      let testDateStr = columnValue;
      if (!columnValue.includes(':')) {
        testDateStr = columnValue + 'T00:00';
      }
      try {
        let testDate = new Date(testDateStr);
        if (!isNaN(testDate.getTime()) && !isPotentialURL(columnValue)) {
          return EvidenceType.DATE;
        }
      } catch (err) {
        // Ignore
      }
    }
    return EvidenceType.STRING;
  } else if (columnValue instanceof Date && !isNaN(columnValue.getTime())) {
    return EvidenceType.DATE;
  } else {
    return EvidenceType.STRING;
  }
}

function isPotentialURL(value) {
  const urlPattern = /^(https?:\/\/)?([a-zA-Z0-9.-]+)?([/\\?].*)?$/;
  return urlPattern.test(value);
}


/** @type {import("@evidence-dev/db-commons").ConnectionTester<ConnectorOptions>} */
export const testConnection = async (options) => {
  try {
    const response = await axios.get('https://dashboard.simpleanalytics.com/api/users/me', {
      headers: {
        'User-Id': options.UserID,
        'Api-Key': options.apiKey
      }
    });
    return true;
  } catch (error) {
    console.error("Connection test failed:", error);
  }
};




