import "server-only";
import { Resend } from "resend";
import { SHOP } from "./config";
import { formatEUR } from "./pricing";
import type { OrderStatus } from "./types";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const FROM = process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev";

/** Échappe le texte injecté dans le HTML des e-mails (nom client saisi chez Stripe, notamment). */
function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

async function send(to: string, subject: string, html: string) {
  if (!resend) {
    console.warn(`RESEND_API_KEY absent : e-mail "${subject}" à ${to} non envoyé.`);
    return;
  }
  try {
    await resend.emails.send({ from: `${SHOP.name} <${FROM}>`, to, subject, html });
  } catch (e) {
    console.error("Envoi e-mail échoué", e);
  }
}

function layout(title: string, body: string) {
  return `<div style="font-family:sans-serif;color:#1a1a1a;max-width:480px;margin:auto">
    <h1 style="font-size:20px">${title}</h1>
    ${body}
    <p style="margin-top:24px;color:#666">Une question ? <a href="mailto:${SHOP.contactEmail}">${SHOP.contactEmail}</a></p>
  </div>`;
}

type OrderItemLine = { product_title: string; variant_name: string; quantity: number; unit_price: number };
type OrderRelayPoint = { name: string; address1: string; address2?: string; postcode: string; city: string; country: string };
type OrderConfirmation = {
  email: string | null;
  order_number: number;
  customer_name: string | null;
  items: OrderItemLine[];
  subtotal: number;
  shipping: number;
  total: number;
  relayPoint?: OrderRelayPoint | null;
};

export async function sendOrderConfirmationEmail(order: OrderConfirmation) {
  if (!order.email) return;
  const rows = order.items
    .map(
      (it) =>
        `<tr><td style="padding:4px 8px 4px 0">${it.quantity} × ${esc(it.product_title)} — ${esc(it.variant_name)}</td><td style="padding:4px 0;text-align:right;white-space:nowrap">${formatEUR(it.unit_price * it.quantity)}</td></tr>`,
    )
    .join("");
  const relay = order.relayPoint;
  const relayBlock = relay
    ? `<p style="margin-top:16px;padding:12px;background:#f4f4f4;border-radius:8px">
        À retirer en point relais :<br/>
        <strong>${esc(relay.name)}</strong><br/>
        ${esc(relay.address1)}${relay.address2 ? `<br/>${esc(relay.address2)}` : ""}<br/>
        ${esc(relay.postcode)} ${esc(relay.city)}${relay.country && relay.country !== "FR" ? `, ${esc(relay.country)}` : ""}
      </p>`
    : "";
  const body = `
    <p>Merci${order.customer_name ? ` ${esc(order.customer_name)}` : ""} ! Votre commande n° ${order.order_number} est confirmée.</p>
    <table style="width:100%;border-collapse:collapse;margin-top:12px">${rows}</table>
    <p style="text-align:right;margin-top:8px">
      Livraison : ${formatEUR(order.shipping)}<br/>
      <strong>Total : ${formatEUR(order.total)}</strong>
    </p>
    ${relayBlock}
    <p style="margin-top:16px">${SHOP.leadTime}.</p>`;
  await send(order.email, `Commande n° ${order.order_number} confirmée`, layout(`Merci pour votre commande !`, body));
}

type RelayPointAssigned = {
  email: string | null;
  order_number: number;
  relayPoint: OrderRelayPoint;
};

export async function sendRelayPointAssignedEmail(order: RelayPointAssigned) {
  if (!order.email) return;
  const r = order.relayPoint;
  const body = `
    <p>Votre commande n° ${order.order_number} sera à retirer dans ce point relais :</p>
    <p style="margin-top:12px;padding:12px;background:#f4f4f4;border-radius:8px">
      <strong>${esc(r.name)}</strong><br/>
      ${esc(r.address1)}${r.address2 ? `<br/>${esc(r.address2)}` : ""}<br/>
      ${esc(r.postcode)} ${esc(r.city)}${r.country && r.country !== "FR" ? `, ${esc(r.country)}` : ""}
    </p>
    <p style="margin-top:16px">Vous recevrez un e-mail de suivi dès l&apos;expédition de votre colis.</p>`;
  await send(
    order.email,
    `Commande n° ${order.order_number} : point relais confirmé`,
    layout(`Votre point de retrait est confirmé`, body),
  );
}

const STATUS_LABELS: Record<OrderStatus, string> = {
  paid: "payée, en attente d'impression",
  printing: "en cours d'impression",
  shipped: "expédiée",
  delivered: "livrée",
  cancelled: "annulée",
};

type OrderStatusUpdate = {
  email: string | null;
  order_number: number;
  status: OrderStatus;
  tracking_number: string | null;
};

export async function sendOrderStatusEmail(order: OrderStatusUpdate) {
  if (!order.email) return;
  const body = `
    <p>Votre commande n° ${order.order_number} est désormais <strong>${STATUS_LABELS[order.status]}</strong>.</p>
    ${order.tracking_number ? `<p>Numéro de suivi : <strong>${esc(order.tracking_number)}</strong></p>` : ""}`;
  await send(
    order.email,
    `Commande n° ${order.order_number} : ${STATUS_LABELS[order.status]}`,
    layout(`Mise à jour de votre commande`, body),
  );
}
