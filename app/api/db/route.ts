import { NextResponse } from "next/server";
import {
  execAddStaff,
  execAdjustIngredient,
  execAdvanceKitchen,
  execAdminApprovePayment,
  execAdminRecordPayment,
  execAdminRejectPayment,
  execAdminSendReminder,
  execAdminSubscriptionPayments,
  execAdminUpdateSubscription,
  execCreateOrder,
  execDelete,
  execInsert,
  execMarkNotificationsRead,
  execRemoveStaff,
  execRestockIngredient,
  execSelect,
  execSubmitPayment,
  execUpdate,
  execUpdateStaff,
  execUpdateSiteContent,
  authGetUser,
  type DbQueryPlan,
} from "@/lib/mysql/executor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { data: auth } = await authGetUser();
    if (!auth.user) {
      return NextResponse.json(
        { data: null, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const body = (await request.json()) as {
      op: "select" | "insert" | "update" | "delete" | "rpc";
      table?: string;
      plan?: DbQueryPlan;
      payload?: Record<string, unknown>;
      filters?: unknown[];
      name?: string;
      args?: Record<string, unknown>;
    };

    switch (body.op) {
      case "select":
        return NextResponse.json(await execSelect(body.plan!));
      case "insert":
        return NextResponse.json(
          await execInsert({ table: body.table!, payload: body.payload! })
        );
      case "update":
        return NextResponse.json(
          await execUpdate({
            table: body.table!,
            payload: body.payload!,
            filters: (body.filters as never) ?? undefined,
          })
        );
      case "delete":
        return NextResponse.json(
          await execDelete({
            table: body.table!,
            filters: (body.filters as never) ?? undefined,
          })
        );
      case "rpc":
        if (body.name === "create_order") {
          return NextResponse.json(await execCreateOrder(body.args as never));
        }
        if (body.name === "advance_kitchen") {
          return NextResponse.json(await execAdvanceKitchen(body.args as never));
        }
        if (body.name === "restock_ingredient") {
          return NextResponse.json(await execRestockIngredient(body.args as never));
        }
        if (body.name === "adjust_ingredient") {
          return NextResponse.json(await execAdjustIngredient(body.args as never));
        }
        if (body.name === "add_staff") {
          return NextResponse.json(await execAddStaff(body.args as never));
        }
        if (body.name === "update_staff") {
          return NextResponse.json(await execUpdateStaff(body.args as never));
        }
        if (body.name === "remove_staff") {
          return NextResponse.json(await execRemoveStaff(body.args as never));
        }
        if (body.name === "subscription_payments") {
          return NextResponse.json(
            await execAdminSubscriptionPayments(body.args as never)
          );
        }
        if (body.name === "record_subscription_payment") {
          return NextResponse.json(
            await execAdminRecordPayment(body.args as never)
          );
        }
        if (body.name === "approve_subscription_payment") {
          return NextResponse.json(
            await execAdminApprovePayment(body.args as never)
          );
        }
        if (body.name === "reject_subscription_payment") {
          return NextResponse.json(
            await execAdminRejectPayment(body.args as never)
          );
        }
        if (body.name === "update_subscription") {
          return NextResponse.json(
            await execAdminUpdateSubscription(body.args as never)
          );
        }
        if (body.name === "send_reminder") {
          return NextResponse.json(await execAdminSendReminder(body.args as never));
        }
        if (body.name === "mark_notifications_read") {
          return NextResponse.json(await execMarkNotificationsRead());
        }
        if (body.name === "update_site_content") {
          return NextResponse.json(await execUpdateSiteContent(body.args as never));
        }
        if (body.name === "submit_payment") {
          return NextResponse.json(await execSubmitPayment(body.args as never));
        }
        return NextResponse.json({
          data: null,
          error: { message: `Unknown RPC: ${body.name}` },
        });
      default:
        return NextResponse.json(
          { data: null, error: { message: "Unknown operation" } },
          { status: 400 }
        );
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Database error";
    return NextResponse.json(
      { data: null, error: { message } },
      { status: 500 }
    );
  }
}