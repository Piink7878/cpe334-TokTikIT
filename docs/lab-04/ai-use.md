# Lab 4 — AI Use and Reflection

**LLM/agent used:** Claude Code (Anthropic Claude) ใน VS Code

## Selected key prompts (8)

| # | Prompt | Reflection |
|---|--------|------------|
| 1 | "Create a plan for Issue 2 first and send it to me. Check the scope and SE-Lab-4-Requirements.md to ensure they are consistent, and be careful with Labs 1–3. Once approved, you are allowed to proceed according to the plan. Don't forget to update and periodically check for accuracy." | ให้ AI ทำแผนและเทียบ Scope กับ Handout ก่อนลงมือเสมอ ทำให้เห็นข้อขัดแย้งตั้งแต่ก่อนเขียนโค้ด (เช่น การไม่แตะข้อมูล Lab 1–3) และเป็นจุดควบคุมให้ฉันอนุมัติทีละขั้น ไม่ปล่อยให้ AI ทำเกินขอบเขต |
| 2 | "ครั้งต่อไปช่วยเพิ่มกระบวนการตรวจสอบความถูกต้องของงานใน issue นั้นๆ ด้วยว่าถูกต้องตาม scope, รายละเอียดที่ตั้งไว้หรือเปล่า ตรวจสอบจุดบกพร่องที่น่าจะมีปัญหาด้วย" | เปลี่ยนวิธีทำงานให้ทุก Issue มีขั้นตอน Verify (ตรวจ Scope/Spec, หาจุดบกพร่อง, Mutation check) ก่อนเปิด PR ทำให้เพื่อนเจอ Bug ใน Review น้อยลงและแต่ละ PR มีหลักฐานการทดสอบแนบ |
| 3 | "Terminal tickets: should the Add and Edit buttons be disabled on CLOSED, CANCELLED and REJECTED tickets, as the spec proposes in UI-Q3? : yes … E2E: keep it for a later issue … no need to Commit in small commits" | ให้ AI ถามเฉพาะเรื่องที่เป็นการตัดสินใจของเจ้าของงาน แล้วฉันตอบสั้น ๆ ทำให้ Spec ที่ยังเป็นคำถามค้าง (Unresolved Decisions) ถูกปิดเป็น Business Rule ที่ชัดเจน และกันไม่ให้ AI เดาเอง |
| 4 | "Check the latest review and consider which points actually need fixing and which aren't really necessary. I think adding tests doesn't need to be overly comprehensive." | ใช้ AI คัดกรองคอมเมนต์ของเพื่อนทีละข้อเทียบกับโค้ดจริง ข้อที่จริงจึงแก้ ข้อที่ไม่จำเป็นอธิบายเหตุผลกลับไป ช่วยประหยัดเวลาและไม่แก้ตามทุกข้อแบบไม่คิด |
| 5 | "Help review the consistency, errors, or bugs one more time to get it approved by my friend." | ให้ AI ไล่ตรวจ PR เสมือนผู้รีวิวอีกคนก่อนส่งจริง จับความไม่สอดคล้องระหว่างเอกสารกับโค้ด และบั๊กเล็ก ๆ ได้ก่อนเพื่อนเห็น |
| 6 | "Items 1-2: Go with whichever option you think is best. Item 3: I'd like it to point to the open Lab 4 issue." | มอบอำนาจตัดสินใจเรื่องเทคนิคให้ AI พร้อมให้ AI อธิบายเหตุผล แต่ยังกำหนดเองในเรื่องที่เกี่ยวกับ Workflow ของทีม (เช่น ให้ PR ชี้ไปที่ Issue ที่ยังเปิดอยู่) |
| 7 | "For Decisions 1 and 2, you can make the call. As for 3, no need to add anything that isn't explicitly required. and after completing the plan, check for any bugs and inconsistencies, and fix them." | จำกัดขอบเขตไม่ให้เพิ่มฟีเจอร์เกินที่ต้องการ แล้วให้ AI ตรวจหาบั๊กของงานตัวเอง ผลคือ Issue 6 พบและแก้ปัญหาจริง เช่น เมนูนำทางหายบนจอเล็ก, Input ผิดชนิดทำให้ Server ตอบ 500, และปัญหา Accessibility |
| 8 | "check recent request changes review and determind if it nessesary to solve then solve if not, describe her" | ตัวอย่างที่ชัดที่สุดของการทำงานร่วมกัน: เพื่อนขอ Server-side Idempotency ให้ AI ประเมินว่าอยู่ใน Scope จริง แล้วทำจนมีทั้ง migration, ฝั่ง UI และ test ที่จำลอง Response หาย โดยไม่กระทบข้อมูลเดิม |

## Reflection
การใช้ AI ใน Lab 4 ทำให้ฉันเห็นว่า AI มีประโยชน์ที่สุดเมื่อแยกบทบาทชัดเจนระหว่าง "ผู้เขียน Spec" กับ "ผู้เขียนโค้ด" ฝั่ง Specification Agent ช่วยร่าง Requirement, Business Rule, Acceptance Criteria และ Traceability ให้ครบก่อนเริ่ม Implement แต่จุดที่ต้องตรวจเองเสมอคือ Spec ที่ขัดกันเอง (เช่น Action Taken แก้ไขได้แต่เป็น Append-only) ซึ่งเพื่อนผู้รีวิวจับได้ ทำให้ฉันเข้าใจว่า AI เขียนเอกสารได้เร็วแต่ไม่ได้รับประกันว่าสอดคล้องกัน ฝั่ง Coding Agent ทำงานได้ดีเมื่อให้ทำทีละ Issue พร้อมแผนที่ฉันอนุมัติก่อน และเมื่อบังคับให้มีขั้นตอนตรวจสอบหลังทำ (เทียบ Scope, ลองใช้งานจริงใน Browser, ทดสอบด้วย Mutation) จึงเจอปัญหาที่ Test ปกติมองไม่เห็น เช่น Race Condition ของสถานะ Ticket และการกดซ้ำที่ทำให้ข้อมูลซ้ำ

สิ่งที่ฉันเรียนรู้คือไม่ควรเชื่อผลลัพธ์ของ AI เพียงเพราะ Test ผ่าน ต้องถามว่า Test นั้นจับความผิดพลาดได้จริงหรือไม่ และไม่ควรแก้ตามทุกคอมเมนต์ของรีวิวโดยอัตโนมัติ แต่ให้ประเมินเทียบกับโค้ดและ Scope ก่อน การควบคุมขอบเขต (ทีละ Issue, ไม่เพิ่มของที่ไม่ได้ขอ, ไม่แตะพฤติกรรม Lab 1–3) ทำให้ผลงานตรวจสอบย้อนกลับได้ และการที่ AI รายงานตามจริงเมื่อผลทดสอบไม่เป็นไปตามคาด ทำให้ฉันไว้ใจเอกสารหลักฐานที่ส่งมากขึ้น
