import {describe, expect, it} from 'vitest';
import {campaignBrief, campaignTerms, evaluatePromotionLogistics, type LogisticsInputs} from './src/utils/promotionLogistics';
import {buildPromotionBrief, recommendPromotion, briefToPrompt, type AdvisorAction} from './src/utils/promotionAdvisor';
import {assessStrategyAction} from './supabase/functions/_shared/promotionStrategy';
import {promotionToDiscountCode, validateDiscountCode} from './src/utils/discountService';
import type {WebProduct} from './src/types/websiteContent';
import type {ShopPromotion} from './src/types/bikeShop';

const action: AdvisorAction = {title:'Useful check', rationale:'Use recorded prices', objective:'workshop', categories:['cycle'], startDate:'2026-10-20', endDate:'2026-10-25', confidence:0.4, offerPriceGbp:60, segmentId:'cycle:commuter:over-750', serviceId:'check', audienceDescription:'Commuter riders with confirmed budgets', spendCeilingGbp:80, requiresQuote:true};
const inputs: LogisticsInputs = {quantity:5, available:6, unitCostGbp:30, campaignCostGbp:40, minimumContributionGbp:10, vatPct:20, reviewed:true};
const product: WebProduct = {id:'p1', name:'Useful part', price:60, category:'Second hand parts', stock:5, image:''};
const assess = (over: Partial<LogisticsInputs> = {}, a = action, products: WebProduct[] = [], promos: ShopPromotion[] = []) => evaluatePromotionLogistics(a, a, {...inputs,...over}, products, promos, '2026-10-16');

describe('promotion operational review', () => {
  it('uses VAT-exclusive revenue, full costs and fixed spend for contribution and break-even', () => {
    const result = assess();
    expect(result.ready).toBe(true);
    expect(result.unitContributionGbp).toBe(20);
    expect(result.campaignContributionGbp).toBe(60);
    expect(result.breakEvenUnits).toBe(2);
  });
  it.each([
    {unitCostGbp:undefined}, {campaignCostGbp:undefined}, {vatPct:undefined}, {minimumContributionGbp:undefined},
    {quantity:2.5}, {quantity:0}, {quantity:7}, {available:undefined}, {unitCostGbp:51}, {minimumContributionGbp:21},
    {campaignCostGbp:101}, {reviewed:false}, {unitCostGbp:NaN}, {vatPct:Infinity},
  ])('blocks unverified or unviable operation: %j', (over) => expect(assess(over).ready).toBe(false));
  it('keeps quote-only economics unknown instead of inventing revenue', () => {
    const result = assess({unitCostGbp:undefined, campaignCostGbp:undefined, vatPct:undefined}, {...action,offerPriceGbp:undefined});
    expect(result.ready).toBe(true);
    expect(result.campaignContributionGbp).toBeUndefined();
    expect(result.breakEvenUnits).toBeUndefined();
  });
  it('rechecks recorded stock and prices; does not treat notes as reservations', () => {
    const stock: AdvisorAction = {...action, objective:'stock', productId:'p1'};
    expect(assess({available:5},stock,[product]).ready).toBe(true);
    expect(assess({},stock,[product]).ready).toBe(false);
    expect(assess({available:5},stock,[{...product,stock:4}]).ready).toBe(false);
    expect(assess({available:5},stock,[{...product,price:70}]).ready).toBe(false);
    expect(assess({available:5},stock,[]).ready).toBe(false);
  });
  it('blocks invalid dates, past dates and an all-category overlap', () => {
    expect(assess({}, {...action,startDate:'2026-02-30'}).ready).toBe(false);
    expect(assess({}, {...action,startDate:'2026-10-15'}).ready).toBe(false);
    const promo: ShopPromotion = {title:'Existing',subtitle:'',code:'LIVE',badgeText:'',termsAndConditions:[],bgGradient:'',id:'live',status:'active', startDate:action.startDate, endDate:action.endDate,eligibleCategories:[]};
    expect(assess({},action,[],[promo]).ready).toBe(false);
  });
  it('revalidates the live service catalogue before approving an older idea', () => {
    const priceList = [{id:'check',scope:'bike' as const,group:'Workshop',item:'Check',price:'£60',unitPrice:60}];
    expect(evaluatePromotionLogistics(action, action, inputs, [], [], '2026-10-16', priceList).ready).toBe(true);
    expect(evaluatePromotionLogistics(action, action, inputs, [], [], '2026-10-16', [{...priceList[0],unitPrice:65}]).ready).toBe(false);
    expect(evaluatePromotionLogistics(action, action, inputs, [], [], '2026-10-16', []).ready).toBe(false);
  });
  it('stores public scope and explicit quote terms without exposing private costs', () => {
    const brief = campaignBrief(action,5);
    expect(brief.serviceId).toBe(action.serviceId);
    expect(brief.segmentId).toBe(action.segmentId);
    expect(brief.uptakeLimit).toBe(5);
    expect(JSON.stringify(brief)).not.toMatch(/unitCost|campaignCost|staffNotes/);
    expect(campaignTerms(action,5).join(' ')).toMatch(/£80.00 including parts/);
    const code = promotionToDiscountCode({...action,id:'id',title:'Campaign',subtitle:'',code:'QUOTE',status:'active',badgeText:'',termsAndConditions:[],eligibleCategories:['cycle'],bgGradient:'',discountPercentage:20,campaignBrief:brief});
    expect(code.value).toBe(0);
    expect(validateDiscountCode(code,{subtotal:100,isMember:true}).ok).toBe(false);
  });
});

describe('balanced campaign evidence', () => {
  it('covers all four goals offline and sends live stock evidence without cost or customer identities', () => {
    const brief = buildPromotionBrief([],[],new Date('2026-10-16T10:00:00Z'),null,[],[],{products:[product,{...product,id:'empty',stock:0}]});
    const actions = recommendPromotion(brief).actions;
    expect(new Set(actions.map(a => a.objective))).toEqual(new Set(['workshop','stock','retention','growth']));
    expect(brief.strategy.products).toHaveLength(1);
    expect(briefToPrompt(brief)).toMatch(/Balance all four/);
    const stock = actions.find(a => a.objective === 'stock')!;
    expect(stock.productId).toBe('p1');
    expect(stock.offerPriceGbp).toBe(60);
    expect(stock.spendCeilingGbp).toBeUndefined();
    expect(stock.requiresQuote).toBe(true);
  });
  it('rejects made-up, empty or mixed product and service references', () => {
    const strategy = buildPromotionBrief([],[],new Date('2026-10-16'),null,[],[],{products:[product]}).strategy;
    expect(assessStrategyAction({objective:'stock',productId:'invented'},strategy)).toBeNull();
    expect(assessStrategyAction({objective:'stock'},strategy)).toBeNull();
    expect(assessStrategyAction({objective:'stock',productId:'p1',serviceId:'check'},strategy)).toBeNull();
    expect(assessStrategyAction({objective:'stock',productId:'p1',offerPriceGbp:1,discountPercentage:99},strategy)?.offerPriceGbp).toBe(48);
  });
  it('marks missing stock as a gap rather than inventing clearance offers', () => {
    const brief = buildPromotionBrief([],[],new Date('2026-10-16'),null,[],[],{});
    expect(brief.strategy.gaps.join(' ')).toMatch(/No in-stock/);
    expect(recommendPromotion(brief).actions.some(a => a.objective === 'stock')).toBe(false);
  });
});
