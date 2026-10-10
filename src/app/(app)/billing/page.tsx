import { requireUser } from "@/lib/auth/server";
import { check } from "@/lib/api";
import { Heading, Badge } from "@/components/ui";
import { plans } from "@/config/plans";
import { platformSettings } from "@/lib/platform/server";
import type { Plan } from "@/config/plans";
export default async function Billing() {
  const { db, user } = await requireUser();
  if (process.env.BILLING_ENABLED !== "true")
    return (
      <div className="stack">
        <Heading
          title="Billing is disabled"
          description="This self-hosted installation does not use payment processing. Core persona and streaming controls remain available under the configured local policies."
        />
      </div>
    );
  const limits = await platformSettings();
  const { data, error } = await db
    .from("subscriptions")
    .select("*")
    .eq("user_id", user.id)
    .single();
  check(error);
  return (
    <div className="stack">
      <Heading
        title="Room to create."
        description="A plan for every stage of your creative journey."
      />
      <div className="notice">
        Billing is not connected yet. Paid plans are a preview; no checkout or
        plan changes are available.
      </div>
      <div className="grid3">
        {Object.entries(plans).map(([id, plan]) => (
          <div
            className="card stack"
            key={id}
            style={id === data.plan ? { borderColor: "#c5f47b66" } : {}}
          >
            <div className="row between">
              <h2>{plan.name}</h2>
              {id === data.plan && <Badge status="Current plan" />}
            </div>
            <p>
              {id === "free"
                ? "Find your presence."
                : id === "creator"
                  ? "Build your creative rhythm."
                  : "For your next big stage."}
            </p>
            <div className="divider" />
            <p>
              {limits["pricing.plans"].currency}{" "}
              {limits["pricing.plans"][id as Plan]} / month
            </p>
            <ul
              className="stack"
              style={{ paddingLeft: 18, fontSize: 13, gap: 12 }}
            >
              {plan.features.map((f, index) => (
                <li key={f}>
                  {index === 0
                    ? `${limits[`personas.${id as Plan}_limit`]} personas`
                    : index === 1
                      ? `${limits["plans.monthly_minutes"][id as Plan]} streaming minutes / month`
                      : f}
                </li>
              ))}
            </ul>
            <button disabled className="btn">
              {id === data.plan ? "Your current plan" : "Coming soon"}
            </button>
          </div>
        ))}
      </div>
      <p style={{ fontSize: 12 }}>
        Plan limits are enforced by the server. Payments will be managed through
        a billing provider in a future release.
      </p>
    </div>
  );
}
