# Metro Complaint Triage: Department Taxonomy

This document defines the official classification taxonomy for the Complaint Triage Engine (CTE).

## Primary Departments

| Department ID | Display Name | Scope / Inclusions | Exclusions |
|---|---|---|---|
| `safety` | Safety & Security | Fire, smoke, gas leaks, track intrusions, falls, physical injuries, harassment/assault, unattended bags/objects, electrical hazards, unconscious persons, lost children. | Cleanliness spills without slipping hazard, routine staff inquiries. |
| `cleanliness` | Cleanliness & Hygiene | Dirty platforms/trains, garbage, pest issues, foul odors, overflowing bins, uncleaned washrooms, spit marks. | Hazardous chemical or gas leaks (categorized as `safety`). |
| `fare` | Ticketing & Fare | Smart card errors, AFC gate rejection, double billing, token machine faults, recharge failures, balance discrepancy. | Harassment by ticketing staff (primary `staff_behaviour`, secondary `fare`). |
| `lifts_escalators` | Lifts & Escalators | Elevator out of service, escalator stuck or making abnormal noises, emergency stop triggered, button panel broken. | Passenger trapped inside lift (classified under `safety` floor). |
| `staff_behaviour` | Staff Behaviour | Rude staff, absent station controller, unhelpful customer care, security guard misconduct, overcharging by counter staff. | Severe harassment or physical threats (classified under `safety`). |
| `other` | General / Other | Announcements inaudible, AC cooling issues, signage errors, timetable queries, lost and found, general feedback. | Specific departmental issues. |

## Multi-Department Rules & Secondary Assignments
When a complaint mentions multiple issues (e.g., "The lift was broken and when I asked the staff they were rude"):
- Primary: Department with higher operational or safety impact (e.g., `lifts_escalators`).
- Secondary: Secondary contributing issue (e.g., `staff_behaviour`).

## Priority Levels
- **P1 (Safety-critical, urgency ≥ 80)**: Immediate operational risk or passenger safety hazard. Pinned to the top of station queues.
- **P2 (Service-impacting, urgency 50–79)**: Disrupted passenger flow, broken transit amenities, payment failures.
- **P3 (Routine, urgency < 50)**: Minor cleanliness, general information, feedback.
- **REVIEW**: Assigned when classifier confidence < 0.60 or conflicting signals are detected.
