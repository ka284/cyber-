import mysql from 'mysql2/promise';

const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = Number.parseInt(process.env.DB_PORT || '3306', 10);
const DB_USER = process.env.DB_USER || 'root';
const DB_PASSWORD = process.env.DB_PASSWORD || '';
const DB_NAME = process.env.DB_NAME || 'stego';
const DB_DISABLED = ['1', 'true', 'yes', 'on'].includes(
  String(process.env.DB_DISABLED || '').trim().toLowerCase()
);

let pool = null;
let dbReady = false;
let dbError = null;

function normalizeErrorMessage(message, maxLength = 500) {
  if (!message || typeof message !== 'string') return null;
  return message.length > maxLength ? message.slice(0, maxLength) : message;
}

function normalizeText(value, maxLength) {
  if (!value || typeof value !== 'string') return null;
  return value.length > maxLength ? value.slice(0, maxLength) : value;
}

export async function initDb() {
  if (DB_DISABLED) {
    dbReady = false;
    dbError = null;
    console.log('[DB] Disabled via DB_DISABLED');
    return;
  }
  try {
    const baseConfig = {
      host: DB_HOST,
      port: DB_PORT,
      user: DB_USER,
      password: DB_PASSWORD
    };

    const bootstrap = await mysql.createConnection(baseConfig);
    await bootstrap.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\``);
    await bootstrap.end();

    pool = mysql.createPool({
      ...baseConfig,
      database: DB_NAME,
      connectionLimit: 10,
      waitForConnections: true
    });

    await pool.query(`
      CREATE TABLE IF NOT EXISTS stego_operations (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        operation ENUM('encode','decode') NOT NULL,
        file_type VARCHAR(16) NOT NULL,
        carrier_type VARCHAR(16) NULL,
        input_bytes BIGINT UNSIGNED NULL,
        payload_bytes BIGINT UNSIGNED NULL,
        capacity_bytes BIGINT UNSIGNED NULL,
        status ENUM('success','error') NOT NULL,
        error_message VARCHAR(512) NULL,
        client_ip VARCHAR(64) NULL,
        user_agent VARCHAR(255) NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        INDEX idx_created_at (created_at),
        INDEX idx_operation (operation),
        INDEX idx_status (status)
      )
    `);

    dbReady = true;
    dbError = null;
    console.log('[DB] MySQL connected and ready');
  } catch (error) {
    dbReady = false;
    dbError = error;
    console.error('[DB] Initialization failed:', error.message);
  }
}

export function getDbStatus() {
  return {
    ready: dbReady,
    error: dbError ? dbError.message : null,
    host: DB_HOST,
    port: DB_PORT,
    database: DB_NAME,
    disabled: DB_DISABLED
  };
}

export async function logOperation(entry) {
  if (DB_DISABLED || !pool || !dbReady) return;

  const {
    operation,
    fileType,
    carrierType,
    inputBytes,
    payloadBytes,
    capacityBytes,
    status,
    errorMessage,
    clientIp,
    userAgent
  } = entry;

  try {
    await pool.query(
      `
        INSERT INTO stego_operations
          (operation, file_type, carrier_type, input_bytes, payload_bytes, capacity_bytes,
           status, error_message, client_ip, user_agent)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        operation,
        fileType,
        carrierType || null,
        Number.isFinite(inputBytes) ? inputBytes : null,
        Number.isFinite(payloadBytes) ? payloadBytes : null,
        Number.isFinite(capacityBytes) ? capacityBytes : null,
        status,
        normalizeErrorMessage(errorMessage),
        normalizeText(clientIp, 64),
        normalizeText(userAgent, 255)
      ]
    );
  } catch (error) {
    console.error('[DB] Failed to log operation:', error.message);
  }
}
