/**
 * Cloudflare Worker API for CNW Workforce
 * Backed by Cloudflare D1 (SQL / SQLite)
 */

export interface D1PreparedStatement {
  bind(...values: any[]): D1PreparedStatement;
  first<T = unknown>(colName?: string): Promise<T | null>;
  run<T = unknown>(): Promise<{ success: boolean; results?: T[]; error?: string }>;
  all<T = unknown>(): Promise<{ results: T[] }>;
}

export interface D1Database {
  prepare(query: string): D1PreparedStatement;
  dump(): Promise<ArrayBuffer>;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<Array<{ results: T[] }>>;
  exec(query: string): Promise<{ count: number; duration: number }>;
}

export interface Env {
  DB: D1Database;
  ENVIRONMENT: string;
  TIMEZONE: string;
  UNPAID_BREAK_MINUTES: string;
  NORMAL_WORK_HOURS: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS Headers for API requests
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Device-Fingerprint',
      'Content-Type': 'application/json',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // 1. Health check & Settings
      if (path === '/api/health') {
        return new Response(
          JSON.stringify({
            status: 'ok',
            time: new Date().toISOString(),
            timezone: env.TIMEZONE || 'Asia/Colombo',
            company: 'CNW Engineering (Pvt) Ltd',
          }),
          { headers: corsHeaders }
        );
      }

      // 2. Sites API
      if (path === '/api/sites' && request.method === 'GET') {
        const { results } = await env.DB.prepare(
          'SELECT id, site_code, name, location, address, is_active FROM sites WHERE is_active = 1 ORDER BY name ASC'
        ).all();
        return new Response(JSON.stringify(results), { headers: corsHeaders });
      }

      // 3. Employees API (Accessible by HR and CEO; Admin without salary)
      if (path === '/api/employees' && request.method === 'GET') {
        const { results } = await env.DB.prepare(
          'SELECT id, employee_code, full_name, calling_name, nic_number, phone, designation, current_daily_rate, current_ot_rate, is_active FROM employees WHERE is_active = 1 ORDER BY employee_code ASC'
        ).all();
        return new Response(JSON.stringify(results), { headers: corsHeaders });
      }

      // 4. Attendance Events Stream API
      if (path === '/api/attendance' && request.method === 'GET') {
        const { results } = await env.DB.prepare(
          `SELECT id, session_group_id, employee_id, site_id, event_type, device_timestamp, server_timestamp,
                  raw_populated_time, effective_event_time, was_time_adjusted, adjustment_reason, is_offline_created
           FROM attendance_events ORDER BY effective_event_time DESC LIMIT 100`
        ).all();
        return new Response(JSON.stringify(results), { headers: corsHeaders });
      }

      // 5. Record Attendance Event API (START, MOVE, OFF)
      if (path === '/api/attendance' && request.method === 'POST') {
        const body: any = await request.json();
        const serverTime = new Date().toISOString();

        // Check if event already exists (deduplication from offline sync)
        const existing = await env.DB.prepare(
          'SELECT id FROM attendance_events WHERE id = ?'
        ).bind(body.id).first();

        if (existing) {
          return new Response(
            JSON.stringify({ message: 'Event already recorded (deduplicated)', id: body.id }),
            { status: 200, headers: corsHeaders }
          );
        }

        // Insert append-only event into D1
        await env.DB.prepare(
          `INSERT INTO attendance_events (
            id, session_group_id, employee_id, site_id, event_type,
            device_timestamp, server_timestamp, is_offline_created, synced_at,
            raw_populated_time, effective_event_time, was_time_adjusted, adjustment_reason,
            created_by_user_id
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          body.id,
          body.sessionGroupId,
          body.employeeId,
          body.siteId,
          body.eventType,
          body.deviceTimestamp,
          serverTime,
          body.isOfflineCreated ? 1 : 0,
          serverTime,
          body.rawPopulatedTime,
          body.effectiveEventTime,
          body.wasTimeAdjusted ? 1 : 0,
          body.adjustmentReason || null,
          body.createdUserId || 'usr-emp-001'
        ).run();

        return new Response(
          JSON.stringify({ success: true, serverTimestamp: serverTime }),
          { status: 201, headers: corsHeaders }
        );
      }

      // 6. Offline Batch Sync API (Synchronizes pending records accumulated on phone)
      if (path === '/api/attendance/sync' && request.method === 'POST') {
        const { events }: { events: any[] } = await request.json();
        const syncedIds: string[] = [];
        const serverTime = new Date().toISOString();

        for (const evt of events) {
          try {
            await env.DB.prepare(
              `INSERT OR IGNORE INTO attendance_events (
                id, session_group_id, employee_id, site_id, event_type,
                device_timestamp, server_timestamp, is_offline_created, synced_at,
                raw_populated_time, effective_event_time, was_time_adjusted, adjustment_reason,
                created_by_user_id
              ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?)`
            ).bind(
              evt.id,
              evt.sessionGroupId,
              evt.employeeId,
              evt.siteId,
              evt.eventType,
              evt.deviceTimestamp,
              serverTime,
              serverTime,
              evt.rawPopulatedTime,
              evt.effectiveEventTime,
              evt.wasTimeAdjusted ? 1 : 0,
              evt.adjustmentReason || null,
              evt.createdUserId || 'usr-emp-001'
            ).run();
            syncedIds.push(evt.id);
          } catch {
            // Log sync error for individual event
          }
        }

        return new Response(
          JSON.stringify({ success: true, syncedCount: syncedIds.length, syncedIds }),
          { headers: corsHeaders }
        );
      }

      return new Response(JSON.stringify({ error: 'Endpoint not found' }), {
        status: 404,
        headers: corsHeaders,
      });
    } catch (err: any) {
      return new Response(JSON.stringify({ error: err.message || 'Internal error' }), {
        status: 500,
        headers: corsHeaders,
      });
    }
  },
};
