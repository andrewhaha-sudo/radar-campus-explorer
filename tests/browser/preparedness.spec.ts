import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
async function open(page: Page) {
  await page.getByRole("navigation", { name: "Game navigation" }).getByRole("button", { name: "Resources", exact: true }).click();
}
async function quiz(page: Page, answers: number[]) {
  await page.getByRole("button", { name: "Practice earthquake readiness", exact: true }).click();
  for (let i=0;i<answers.length;i++) {
    await expect(page.getByRole("button", {name:"Check answer",exact:true})).toBeDisabled();
    await page.getByRole("radio").nth(answers[i]).check();
    await page.getByRole("button", {name:"Check answer",exact:true}).click();
    await expect(page.getByRole("radio").first()).toBeDisabled();
    await page.getByRole("button", {name:i===2?"Finish quiz":"Next question",exact:true}).click();
  }
  await page.getByRole("button", {name:"Back to preparedness",exact:true}).click();
}
test('quizzes explain mistakes, preserve best scores and award no duplicate points',async({page})=>{
 await page.goto('/'); await open(page);
 await quiz(page,[0,0,2]);
 await expect(page.getByLabel('Preparedness practice')).toContainText('20 / 120 practice points');
 await page.reload(); await open(page);
 await expect(page.getByLabel('Preparedness practice')).toContainText('Best score: 2 / 3');
 await quiz(page,[1,0,2]);
 await expect(page.getByText('Practice badge earned')).toHaveCount(1);
 await quiz(page,[1,0,2]);
 await expect(page.getByLabel('Preparedness practice')).toContainText('30 / 120 practice points');
 await expect(page.getByRole('dialog')).toBeInViewport();
 const overflow=await page.getByRole('dialog').evaluate(el=>el.scrollWidth>el.clientWidth+1);
 expect(overflow).toBe(false);
});
test('checklist persists, downloads a private record, and reset requires confirmation',async({page})=>{
 await page.goto('/');await open(page);
 const checkbox=page.getByRole('checkbox').first();await checkbox.check();
 await expect(page.getByLabel('Preparedness practice')).toContainText('5 / 120 practice points');
 const downloaded=page.waitForEvent('download');await page.getByRole('button',{name:'Download practice record'}).click();
 const download=await downloaded;const record=JSON.parse(await readFile((await download.path())!,'utf8'));
 expect(record.points).toBe(5); expect(record.drillChecklist.filter((x:{checked:boolean})=>x.checked)).toHaveLength(1);
 expect(Object.keys(record).sort()).toEqual(['application','drillChecklist','notice','points','quizzes','type','version']);
 await page.getByRole('button',{name:'Reset practice progress',exact:true}).click();
 await page.getByRole('alertdialog').getByRole('button',{name:'Keep progress'}).click();
 await expect(checkbox).toBeChecked();
 await page.getByRole('button',{name:'Reset practice progress',exact:true}).click();
 await page.getByRole('alertdialog').getByRole('button',{name:'Reset progress',exact:true}).click();
 await expect(checkbox).not.toBeChecked();
 await page.reload();await open(page);await expect(page.getByRole('checkbox').first()).not.toBeChecked();
});
test('failed local writes never claim saved progress',async({page})=>{
 await page.addInitScript(()=>{const original=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key.startsWith('campus-preparedness'))throw new DOMException('Full','QuotaExceededError');return original.call(this,key,value);};});
 await page.goto('/');await open(page);await page.getByRole('checkbox').first().check();
 await expect(page.getByLabel('Preparedness practice')).toContainText('Storage is unavailable');
 await expect(page.getByLabel('Preparedness practice')).not.toContainText('Progress saved on this device');
});
