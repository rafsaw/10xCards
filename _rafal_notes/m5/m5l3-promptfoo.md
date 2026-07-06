/10x-research code-review-evals

Analyze the current state of "packages/code-reviewer"
in the context of introducing evaluation (evals).

Focus on:
- prompt reusability
- agent importability/reusability
- overall compatibility with Promptfoo

My preferred eval toolkit is Promptfoo.

If Promptfoo is not a good fit for this codebase,
research alternative OSS frameworks for evaluating
LLM prompts and agents using Web Search.

---

/10x-plan code-review-evals Plan how to introduce promptfoo within '@packages/code-reviewer'. My goal is to create first configuration, allowing me to test the same code review prompt on three different models (z-ai/glm-5.1 and deepseek/deepseek-v4-flash). For test cases, there should be one, rather complex diff migrating React 16 component into React 19+ with three impactful flaws in it. LLM-as-a-judge should verify whether code review results correctly identify what is broken. You can also add static test verifying if code review actually fail.

