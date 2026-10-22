/// <reference types="@cloudflare/workers-types" />
declare namespace Cloudflare { interface Env { DEMO_MODE?: string; CONNECTORS?: import('./lib/connector-contract.mjs').ConnectorBinding } }
