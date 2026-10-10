import loginHandler from '../../_lib/authLogin.js';
import logoutHandler from '../../_lib/authLogout.js';
import verifyHandler from '../../_lib/authVerify.js';
import manageHandler from '../../_lib/authManage.js';
import adminDispatcher, { reportErrorHandler, setEnv as setAdminEnv } from '../../_lib/adminHandlers.js';
import { requireAdmin } from '../../_lib/requireAuth.js';
import { getCorsHeaders, handleOptionsResponse } from '../../_lib/cors.js';

export async function onRequest(context) {
  const { request, env, params } = context;
  setAdminEnv(env);

  const corsHeaders = getCorsHeaders(request, env);

  if (request.method === 'OPTIONS') {
    return handleOptionsResponse(request, env);
  }

  const rawAction = params?.action || new URL(request.url).pathname.split('/').filter(Boolean).pop() || '';
  const action = String(rawAction).toLowerCase().trim();

  const wrapHandler = async (fn) => {
    // If Express-like (req, res), wrap response
    const resObj = {
      _status: 200,
      _headers: new Headers(corsHeaders),
      status(s) { this._status = s; return this; },
      setHeader(k, v) { this._headers.set(k, v); return this; },
      json(data) {
        return Response.json(data, {
          status: this._status,
          headers: this._headers
        });
      },
      end(body = null) {
        return new Response(body, {
          status: this._status,
          headers: this._headers
        });
      }
    };

    let body = {};
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      try {
        body = await request.clone().json();
      } catch (_) {}
    }

    const url = new URL(request.url);
    const query = Object.fromEntries(url.searchParams.entries());

    const reqObj = {
      method: request.method,
      url: request.url,
      headers: Object.fromEntries(request.headers.entries()),
      query,
      body,
      rawRequest: request
    };

    return await fn(reqObj, resObj);
  };

  switch (action) {
    case 'login': {
      const res = await loginHandler(request, env);
      for (const [k, v] of corsHeaders.entries()) {
        res.headers.set(k, v);
      }
      return res;
    }
    case 'logout': {
      const res = await logoutHandler(request, env);
      for (const [k, v] of corsHeaders.entries()) {
        res.headers.set(k, v);
      }
      return res;
    }
    case 'verify': {
      const res = await verifyHandler(request, env);
      for (const [k, v] of corsHeaders.entries()) {
        res.headers.set(k, v);
      }
      return res;
    }
    case 'manage-credentials': {
      const res = await manageHandler(request, env);
      for (const [k, v] of corsHeaders.entries()) {
        res.headers.set(k, v);
      }
      return res;
    }
    case 'report-error': {
      return await wrapHandler(reportErrorHandler);
    }
    case 'admin-dealers':
    case 'admin-staff':
    case 'admin-pricing':
    case 'admin-hardware':
    case 'admin-settings':
    case 'admin-document-master':
    case 'admin-audit-logs': {
      if (request.method !== 'POST') {
        return Response.json({ error: 'Method Not Allowed. Use POST.' }, { status: 405, headers: corsHeaders });
      }
      const { payload: adminPayload, errorResponse } = await requireAdmin(request, env);
      if (errorResponse) {
        for (const [k, v] of corsHeaders.entries()) {
          errorResponse.headers.set(k, v);
        }
        return errorResponse;
      }

      return await wrapHandler((req, res) => adminDispatcher(req, res, action, adminPayload));
    }
    default:
      return Response.json({ error: `Not found: ${action}` }, { status: 404, headers: corsHeaders });
  }
}
