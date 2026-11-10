// Dữ liệu một thể cho bảng chia (tải lười khi người học chọn thể): { vocab_id: [ruby, quy tắc] | null }.
// null = từ đó không dùng thể này. Sinh lúc build → file tĩnh /chia-the/<nhóm>/<thể>.json
import type { APIRoute, GetStaticPaths } from "astro";
import { getCollection } from "astro:content";
import { GROUP_OF_KIND, GROUP_SLUG, LIST_GROUPS } from "../../../lib/conjugation";

export const getStaticPaths = (async () => {
  const forms = (await getCollection("conjForms")).map((f) => f.data);
  return forms
    .filter((f) => LIST_GROUPS.includes(f.group))
    .map((f) => ({ params: { group: GROUP_SLUG[f.group], form: f.id }, props: { group: f.group, form: f.id } }));
}) satisfies GetStaticPaths;

export const GET: APIRoute = async ({ props }) => {
  const { group, form } = props as { group: string; form: string };
  const out: Record<string, [string, string] | null> = {};
  for (const { data: e } of await getCollection("conjEntries")) {
    if (GROUP_OF_KIND[e.kind] !== group) continue;
    const v = e.forms.find((x) => x.form === form);
    out[e.vocab_id] = v ? [v.ruby, v.rule] : null;
  }
  return new Response(JSON.stringify(out), { headers: { "Content-Type": "application/json; charset=utf-8" } });
};
