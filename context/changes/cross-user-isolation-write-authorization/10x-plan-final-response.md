Looks good, proceed with these 6 phases in this order.

Please make sure the detailed plan keeps each phase behavior-driven, not file-driven:

1. Harness proves real two-user RLS wiring works.
2. R2 proves user B cannot mutate or reveal user A's resources.
3. R4 proves every locked write route returns 403 and lifecycle exemptions remain usable.
4. R5 proves server-derived ownership/status cannot be forged from the body.
5. Static guardrail proves no app code can introduce a service_role bypass.
6. Cookbook documents the new real-DB integration pattern and when it should be used.

Also keep `npm test` hermetic and put real-DB tests behind `test:integration`.