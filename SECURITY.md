# Security policy

Please do not report exploitable vulnerabilities in public issues. Contact the maintainers privately at the address listed in the repository profile or `NEXT_PUBLIC_ABUSE_EMAIL` when configured. Include affected versions, steps to reproduce, impact, and a safe contact method. Do not include real user face/voice media or secrets in a report.

Operators should keep service-role keys, inference keys, output-token secrets, and private OBS output URLs out of client code and logs. Use HTTPS in production and rotate any credential that may have been exposed.

Shapre processes sensitive identity media. Users must have permission to use every uploaded face and voice. Do not use Shapre for fraud, unauthorized impersonation, identity deception, or non-consensual face or voice cloning. See the in-app acceptable-use policy before deployment.
