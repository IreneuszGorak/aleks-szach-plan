// Pure reference calculator. No network, no retail orders, no name-based SKU guesses.
const aliases = {
 'szt':'szt.','sztuka':'szt.','sztuki':'szt.','sztuk':'szt.',
 'ząbki':'ząbek','ząbków':'ząbek','pęczki':'pęczek','pęczka':'pęczek','pęczków':'pęczek',
 'łyżki':'łyżka','łyżek':'łyżka','łyżeczki':'łyżeczka','łyżeczek':'łyżeczka',
 'plastry':'plaster','plastra':'plaster','plastrów':'plaster',
 'kromki':'kromka','kromek':'kromka','gałązki':'gałązka','liście':'liść',
 'szczypty':'szczypta','odrobiny':'odrobina','kubeczka':'kubeczek',
 'główki':'główka','główkę':'główka','puszki':'puszka','garście':'garść',
 'tsp':'łyżeczka','tbsp':'łyżka','cup':'szklanka (cup)',
};
export const normalizeUnit = unit => unit == null ? null : aliases[String(unit).trim().toLowerCase()] || String(unit).trim().toLowerCase();
const positive = n => typeof n === 'number' && Number.isFinite(n) && n > 0;
const round = (n, digits=4) => Math.round((n + Number.EPSILON)*10**digits)/10**digits;
const qualitative = /do smaku|wg uznania|według uznania|skropienie|szczypta|odrobina|do dekoracji|do posypania|do podsypania/i;

export function toGrams(amount, unit, ingredient) {
 if (!positive(amount)) return {grams:null,reason:'missing_or_invalid_quantity'};
 const u=normalizeUnit(unit), p=ingredient.przeliczniki;
 const mass={g:1,kg:1000,oz:28.349523125,lb:453.59237};
 if (mass[u]) return {grams:amount*mass[u],method:'mass_conversion',approximate:false};
 const volume={ml:1,l:1000,'łyżeczka':5,'łyżka':15,'szklanka (cup)':240};
 if (volume[u] && positive(p.g_na_ml)) return {grams:amount*volume[u]*p.g_na_ml,method:'household_volume_and_density',approximate:true};
 if (u===null) return {grams:null,reason:'quantity_has_no_unit'};
 const grams=p.gramy_na_jednostke[u];
 if (positive(grams)) return {grams:amount*grams,method:'household_weight',approximate:true};
 return {grams:null,reason:'unsupported_or_ambiguous_unit',unit:u};
}

export function scaleForRecipe(recipe, choice) {
 if (choice.multiplier != null) {
  if (choice.servings != null || !positive(choice.multiplier)) throw new Error('Use one positive multiplier OR servings.');
  return {factor:choice.multiplier,assumed:false};
 }
 if (!positive(choice.servings)) throw new Error('Provide positive servings or an explicit recipe multiplier.');
 const base=recipe.porcje || choice.assumedBaseServings;
 if (!positive(base)) return {factor:null,reason:'missing_recipe_servings'};
 return {factor:choice.servings/base,assumed:!recipe.porcje,base};
}

export function calculateShoppingList(data, selection, options={}) {
 const recipes=new Map(data.przepisy.map(r=>[r.id,r]));
 const pantry=new Set(options.pantryIngredientIds||[]);
 const rows=new Map(),issues=[],assumptions=[];
 for (const choice of selection) {
  const recipe=recipes.get(choice.recipeId);
  if (!recipe) throw new Error('Unknown recipe ID: '+choice.recipeId);
  const scale=scaleForRecipe(recipe,choice);
  if (scale.assumed) assumptions.push({recipeId:recipe.id,type:'assumed_servings',value:scale.base});
  if (scale.factor===null) issues.push({recipeId:recipe.id,reason:scale.reason});
  recipe.skladniki.forEach((line,index)=>{
   const ingredient=data.skladniki[line.id];
   if (!ingredient) throw new Error('Ingredient dictionary integrity error: '+line.id);
   if (!rows.has(line.id)) rows.set(line.id,{skladnik_id:line.id,nazwa:ingredient.nazwa,
    cena_za_100g:ingredient.cena_za_100g,waluta:'PLN',produkt_ids:ingredient.produkt_ids,
    typ_pozycji:ingredient.produkt_ids.length?'ingredient_with_catalogue_options':'ingredient',
    mozna_dodac:true,ilosc_g:0,koszt:0,pozycje:[],wymaga_ilosci:false});
   const row=rows.get(line.id);
   const key=recipe.id+':'+index;
   const supplied=options.quantityOverrides?.[key];
   const amount=supplied?.amount ?? (options.useUpperRange===false?line.ilosc:(line.ilosc_max??line.ilosc));
   const unit=supplied?.unit ?? line.jednostka;
   let conversion=toGrams(amount,unit,ingredient);
   if (!supplied && !positive(amount) && options.useTasteDefaults!==false &&
       qualitative.test([line.miara,line.jednostka].filter(Boolean).join(' ')) &&
       positive(ingredient.przeliczniki.domyslnie_do_smaku_g)) {
    conversion={grams:ingredient.przeliczniki.domyslnie_do_smaku_g,method:'taste_budget_default',approximate:true};
   }
   const resolved=data.ilosci_do_kalkulacji?.[key];
   if (!supplied && conversion.grams===null && options.useQuantityDefaults!==false && positive(resolved?.gramy)) {
    conversion={grams:resolved.gramy,method:resolved.typ,approximate:true};
   }
   const waived=line.id==='woda'||pantry.has(line.id);
   const grams=scale.factor!==null&&conversion.grams!==null?conversion.grams*scale.factor:null;
   const cost=waived?0:grams===null?null:grams/100*ingredient.cena_za_100g;
   const item={recipeId:recipe.id,recipeName:recipe.nazwa,lineIndex:index,
    originalAmount:line.ilosc,originalUnit:line.jednostka,originalMeasure:line.miara,
    grams:grams===null?null:round(grams),cost:cost===null?null:round(cost),
    status:waived?'already_available':grams===null?'needs_quantity':'priced',
    reason:waived?(line.id==='woda'?'tap_water':'explicit_pantry_selection'):
      scale.factor===null?scale.reason:conversion.reason||null,
    conversion:conversion.method||null};
   row.pozycje.push(item);
   if (grams!==null) row.ilosc_g+=grams;
   if (cost!==null) row.koszt+=cost;
   if (cost===null) {row.wymaga_ilosci=true;issues.push({recipeId:recipe.id,lineIndex:index,ingredientId:line.id,reason:item.reason});}
   if (conversion.approximate) assumptions.push({recipeId:recipe.id,lineIndex:index,ingredientId:line.id,type:conversion.method});
  });
 }
 const items=[...rows.values()].sort((a,b)=>a.nazwa.localeCompare(b.nazwa,'pl'));
 for (const r of items) {r.ilosc_g=round(r.ilosc_g);r.koszt=round(r.koszt,2);}
 const sum=items.reduce((s,r)=>s+r.koszt,0);
 const complete=items.every(r=>!r.wymaga_ilosci);
 return {pozycje:items,suma_wycenionych_pozycji:round(sum,2),suma_pelna:complete?round(sum,2):null,
  kompletna:complete,liczba_skladnikow:items.length,braki_cen:0,
  wymagaja_ilosci:items.filter(r=>r.wymaga_ilosci).map(r=>r.skladnik_id),
  waluta:'PLN',problemy:issues,zalozenia:assumptions};
}
