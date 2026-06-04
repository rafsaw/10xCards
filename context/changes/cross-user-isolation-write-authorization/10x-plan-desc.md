 Proceed to /10x-plan cross-user-isolation-write-authorization.                                                                                                For planning, assume the preferred direction is a real two-user DB integration harness rather than an RLS-emulating stub.                                   

  The primary R2 oracle is RLS-enforced isolation and the highest-signal target appears to be reviews.ts, where cardId comes from the request body and        
  ownership is enforced only through RLS.
                                                                                                                                                              
  Please ensure the plan:
                                                                                                                                                              
  - starts from behavior and risk, not files
  - contains any required test infrastructure/setup phase
  - states the behavior asserted by each phase
  - clearly separates R2 isolation, R4 retention lock, and R5 validation parity
  - identifies phases that may be suitable for /10x-tdd versus /10x-implement