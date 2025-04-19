import React, { useEffect } from 'react';
import { useSimulatorStore } from '@/store/simulator';
import { Download, Eye, EyeOff, ChevronDown, ChevronUp } from 'lucide-react';
import { 
  MAIN_CATEGORIES,
  INCOME_CATEGORIES, 
  EXPENSE_CATEGORIES, 
  ASSET_CATEGORIES, 
  LIABILITY_CATEGORIES 
} from '@/components/ui/category-select';

function calculateAge(startYear: number, currentAge: number, targetYear: number) {
  return currentAge + (targetYear - startYear);
}

function getLifeEventDescription(
  year: number,
  basicInfo: any,
  lifeEvents: any[],
  source: 'personal' | 'corporate' = 'personal'
): string {
  const events: string[] = [];
  
  // Only include marriage and children events in personal section
  if (source === 'personal') {
    // Marriage event
    if (basicInfo.maritalStatus === 'planning' && basicInfo.spouseInfo?.marriageAge) {
      const marriageYear = basicInfo.startYear + (basicInfo.spouseInfo.marriageAge - basicInfo.currentAge);
      if (year === marriageYear) {
        events.push('結婚');
      }
    }

    // Children birth events
    if (basicInfo.children) {
      basicInfo.children.forEach((child: any, index: number) => {
        const birthYear = basicInfo.startYear - child.currentAge;
        if (year === birthYear) {
          events.push(`第${index + 1}子誕生`);
        }
      });
    }

    // Planned children birth events
    if (basicInfo.plannedChildren) {
      basicInfo.plannedChildren.forEach((child: any, index: number) => {
        const birthYear = basicInfo.startYear + child.yearsFromNow;
        if (year === birthYear) {
          events.push(`第${(basicInfo.children?.length || 0) + index + 1}子誕生`);
        }
      });
    }
  }

  // Life events based on source
  if (lifeEvents) {
    const yearEvents = lifeEvents.filter(event => event.year === year && event.source === source);
    yearEvents.forEach(event => {
      events.push(`${event.description}（${event.type === 'income' ? '+' : '-'}${event.amount}万円）`);
    });
  }

  return events.join('、');
}

// カテゴリー情報を取得するヘルパー関数
function getCategoryName(categoryId: string, categoryList: { id: string; name: string }[]): string {
  const category = categoryList.find(cat => cat.id === categoryId);
  return category ? category.name : 'その他';
}

export function CashFlowForm() {
  const { 
    basicInfo, 
    cashFlow,
    lifeEvents,
    incomeData,
    expenseData,
    assetData,
    liabilityData,
    displaySettings,
    toggleCategoryDisplay,
    setAllCategoriesDisplay,
    setCurrentStep,
    syncCashFlowFromFormData,
  } = useSimulatorStore();
  
  // コンポーネントの状態
  const [expandedSections, setExpandedSections] = React.useState({
    personalIncome: true,
    personalExpense: true,
    personalAsset: true,
    personalLiability: true,
    corporateIncome: true,
    corporateExpense: true,
    corporateAsset: true,
    corporateLiability: true,
  });
  
  const yearsUntilDeath = basicInfo.deathAge - basicInfo.currentAge;
  const years = Array.from(
    { length: yearsUntilDeath + 1 },
    (_, i) => basicInfo.startYear + i
  );

  useEffect(() => {
    syncCashFlowFromFormData();
  }, []);

  const handleExportCSV = () => {
    // ヘッダー行の作成
    const headers = [
      '年度',
      '年齢',
      'イベント（個人）',
      'イベント（法人）',
      ...incomeData.personal.map(item => `${item.name}（万円）`),
      ...incomeData.corporate.map(item => `${item.name}（万円）`),
      ...expenseData.personal.map(item => `${item.name}（万円）`),
      ...expenseData.corporate.map(item => `${item.name}（万円）`),
      '個人収支（万円）',
      '個人総資産（万円）',
      '法人収支（万円）',
      '法人総資産（万円）',
    ];

    // データ行の作成
    const rows = years.map(year => {
      const cf = cashFlow[year] || {
        personalBalance: 0,
        personalTotalAssets: 0,
        corporateBalance: 0,
        corporateTotalAssets: 0
      };

      return [
        year,
        calculateAge(basicInfo.startYear, basicInfo.currentAge, year),
        getLifeEventDescription(year, basicInfo, lifeEvents, 'personal'),
        getLifeEventDescription(year, basicInfo, lifeEvents, 'corporate'),
        ...incomeData.personal.map(item => item.amounts[year] || 0),
        ...incomeData.corporate.map(item => item.amounts[year] || 0),
        ...expenseData.personal.map(item => item.amounts[year] || 0),
        ...expenseData.corporate.map(item => item.amounts[year] || 0),
        cf.personalBalance,
        cf.personalTotalAssets,
        cf.corporateBalance,
        cf.corporateTotalAssets,
      ];
    });

    // CSVデータの作成
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    // BOMを追加してExcelで文字化けを防ぐ
    const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
    const blob = new Blob([bom, csvContent], { type: 'text/csv;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `キャッシュフロー_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleNext = () => {
    setCurrentStep(7);
  };

  const handleBack = () => {
    setCurrentStep(5);
  };

  const inputStyle = "w-24 text-right border border-gray-200 rounded-md px-2 py-1";

  // カテゴリーの色を取得する関数
  const getCategoryColor = (categoryId: string): string => {
    // カテゴリーごとに異なる色を返す
    const colorMap: {[key: string]: string} = {
      // 大枠カテゴリー
      'income': '#4CAF50',     // 緑
      'living': '#F44336',     // 赤
      'housing': '#FF9800',    // オレンジ
      'asset': '#2196F3',      // 青
      'liability': '#9C27B0',  // 紫
      'other': '#9E9E9E',      // グレー
    };
    
    return colorMap[categoryId] || '#9E9E9E'; // デフォルトはグレー
  };

  // カテゴリーのタイトル部分を表示する
  const renderCategoryHeader = (categoryId: string, categoryList: { id: string; name: string }[], itemCount: number) => {
    const category = categoryList.find(cat => cat.id === categoryId);
    return (
      <tr className="bg-gray-100">
        <td colSpan={years.length + 3} className="px-4 py-2 font-medium text-gray-700">
          <div className="flex items-center">
            <span className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: getCategoryColor(categoryId) }}></span>
            {category ? category.name : 'その他'} ({itemCount}項目)
          </div>
        </td>
      </tr>
    );
  };

  // セクションの展開・折りたたみを切り替える
  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections({
      ...expandedSections,
      [section]: !expandedSections[section],
    });
  };

  // カテゴリーグループの処理
  const getCategoryGroups = (
    section: 'personal' | 'corporate',
    dataType: 'income' | 'expense' | 'asset' | 'liability'
  ) => {
    const dataMap = {
      'income': incomeData,
      'expense': expenseData,
      'asset': assetData,
      'liability': liabilityData,
    };
    
    const categoryMap = {
      'income': INCOME_CATEGORIES,
      'expense': EXPENSE_CATEGORIES,
      'asset': ASSET_CATEGORIES,
      'liability': LIABILITY_CATEGORIES,
    };
    
    const data = dataMap[dataType][section];
    const categories = categoryMap[dataType];
    
    // カテゴリーごとにグループ化
    const groups: { [key: string]: any[] } = {};
    
    // 表示されているカテゴリーのみを対象に
    data.forEach(item => {
      // displaySettings が未定義または displaySettings[`${dataType}Categories`] が未定義の場合、
      // デフォルトですべて表示
      const categorySettings = displaySettings && displaySettings[`${dataType}Categories`];
      const isVisible = !categorySettings || categorySettings[item.category || 'other'] !== false;
      
      if (isVisible) {
        const categoryId = item.category || 'other';
        if (!groups[categoryId]) {
          groups[categoryId] = [];
        }
        groups[categoryId].push(item);
      }
    });
    
    return { groups, categories };
  };

  // カテゴリーの表示・非表示切り替えボタン
  const renderCategoryFilters = (dataType: 'income' | 'expense' | 'asset' | 'liability') => {
    const categoryMap = {
      'income': INCOME_CATEGORIES,
      'expense': EXPENSE_CATEGORIES,
      'asset': ASSET_CATEGORIES,
      'liability': LIABILITY_CATEGORIES,
    };
    
    const categories = categoryMap[dataType];
    
    // displaySettings が未定義の場合、デフォルト設定を作成
    const defaultSettings: {[key: string]: boolean} = {};
    categories.forEach(cat => {
      defaultSettings[cat.id] = true;
    });
    
    // displaySettings が undefined の場合、デフォルト設定を使用
    const settings = displaySettings && displaySettings[`${dataType}Categories`] 
      ? displaySettings[`${dataType}Categories`] 
      : defaultSettings;
    
    return (
      <div className="mb-4">
        <div className="flex items-center space-x-2 mb-2">
          <span className="text-sm font-medium">カテゴリー表示:</span>
          <button
            type="button"
            onClick={() => setAllCategoriesDisplay(dataType, true)}
            className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded hover:bg-blue-200"
          >
            すべて表示
          </button>
          <button
            type="button"
            onClick={() => setAllCategoriesDisplay(dataType, false)}
            className="px-2 py-1 text-xs bg-gray-100 text-gray-800 rounded hover:bg-gray-200"
          >
            すべて非表示
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {categories.map(category => (
            <button
              key={category.id}
              type="button"
              onClick={() => toggleCategoryDisplay(dataType, category.id)}
              className={`flex items-center px-2 py-1 text-xs rounded ${
                settings[category.id] !== false
                  ? 'bg-blue-100 text-blue-800 hover:bg-blue-200' 
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              {settings[category.id] !== false ? <Eye className="h-3 w-3 mr-1" /> : <EyeOff className="h-3 w-3 mr-1" />}
              {category.name}
            </button>
          ))}
        </div>
      </div>
    );
  };

  const renderPersonalTable = () => {
    const sections = [
      { title: '収入', dataType: 'income' as const, expanded: expandedSections.personalIncome },
      { title: '支出', dataType: 'expense' as const, expanded: expandedSections.personalExpense },
      { title: '資産', dataType: 'asset' as const, expanded: expandedSections.personalAsset },
      { title: '負債', dataType: 'liability' as const, expanded: expandedSections.personalLiability },
    ];

    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">個人キャッシュフロー</h3>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-sm font-medium text-gray-500 sticky left-0 bg-gray-50">項目</th>
                {years.map(year => (
                  <th key={year} className="px-4 py-2 text-right text-sm font-medium text-gray-500">
                    {year}年
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              <tr>
                <td className="px-4 py-2 text-sm text-gray-900 sticky left-0 bg-white">年齢</td>
                {years.map(year => (
                  <td key={year} className="px-4 py-2 text-right text-sm text-gray-900">
                    {calculateAge(basicInfo.startYear, basicInfo.currentAge, year)}歳
                  </td>
                ))}
              </tr>
              <tr>
                <td className="px-4 py-2 text-sm text-gray-900 sticky left-0 bg-white">イベント</td>
                {years.map(year => (
                  <td key={year} className="px-4 py-2 text-right text-xs text-gray-600">
                    {getLifeEventDescription(year, basicInfo, lifeEvents, 'personal')}
                  </td>
                ))}
              </tr>
              
              {/* 各セクションをレンダリング */}
              {sections.map(section => (
                <React.Fragment key={section.title}>
                  {/* セクションヘッダー */}
                  <tr className="bg-blue-50 cursor-pointer" onClick={() => toggleSection(`personal${section.dataType.charAt(0).toUpperCase() + section.dataType.slice(1)}` as keyof typeof expandedSections)}>
                    <td colSpan={years.length + 1} className="px-4 py-2 sticky left-0 bg-blue-50">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-blue-800">{section.title}</span>
                        {section.expanded ? 
                          <ChevronUp className="h-4 w-4 text-blue-800" /> : 
                          <ChevronDown className="h-4 w-4 text-blue-800" />
                        }
                      </div>
                    </td>
                  </tr>
                  
                  {section.expanded && (
                    <>
                      {/* カテゴリーフィルター */}
                      <tr>
                        <td colSpan={years.length + 1} className="px-4 py-2 bg-gray-50 sticky left-0">
                          {renderCategoryFilters(section.dataType)}
                        </td>
                      </tr>
                      
                      {/* カテゴリーごとにグループ化したアイテム */}
                      {(() => {
                        const { groups, categories } = getCategoryGroups('personal', section.dataType);
                        
                        // カテゴリーごとのレンダリング
                        return Object.entries(groups).map(([categoryId, items]) => (
                          <React.Fragment key={categoryId}>
                            {/* カテゴリーヘッダー */}
                            {renderCategoryHeader(categoryId, categories, items.length)}
                            
                            {/* カテゴリー内の項目 */}
                            {items.map(item => (
                              <tr key={item.id}>
                                <td className="px-4 py-2 text-sm text-gray-900 sticky left-0 bg-white">
                                  <div className="flex items-center">
                                    <span className="w-2 h-2 rounded-full mr-2" style={{ backgroundColor: getCategoryColor(categoryId) }}></span>
                                    {item.name}（万円）
                                  </div>
                                </td>
                                {years.map(year => (
                                  <td key={year} className="px-4 py-2 text-right text-sm">
                                    <input
                                      type="number"
                                      value={item.amounts[year] || ''}
                                      onChange={(e) => {
                                        const value = e.target.value === '' ? 0 : Number(e.target.value);
                                        if (!isNaN(value)) {
                                          item.amounts[year] = value;
                                          syncCashFlowFromFormData();
                                        }
                                      }}
                                      className={inputStyle}
                                    />
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </React.Fragment>
                        ));
                      })()}
                    </>
                  )}
                </React.Fragment>
              ))}
              
              {/* 合計値 */}
              <tr className="bg-gray-50 font-medium">
                <td className="px-4 py-2 text-sm text-gray-900 sticky left-0 bg-gray-50">収支</td>
                {years.map(year => {
                  const balance = cashFlow[year]?.personalBalance || 0;
                  return (
                    <td key={year} className={`px-4 py-2 text-right text-sm ${balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {balance}万円
                    </td>
                  );
                })}
              </tr>
              <tr className="bg-gray-50 font-medium">
                <td className="px-4 py-2 text-sm text-gray-900 sticky left-0 bg-gray-50">総資産</td>
                {years.map(year => {
                  const assets = cashFlow[year]?.personalTotalAssets || 0;
                  return (
                    <td key={year} className={`px-4 py-2 text-right text-sm ${assets >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {assets}万円
                    </td>
                  );
                })}
              </tr>
              <tr className="bg-gray-50 font-medium">
                <td className="px-4 py-2 text-sm text-gray-900 sticky left-0 bg-gray-50">純資産</td>
                {years.map(year => {
                  const totalAssets = cashFlow[year]?.personalTotalAssets || 0;
                  const liabilities = liabilityData.personal.reduce((total, liability) => {
                    return total + (liability.amounts[year] || 0);
                  }, 0);
                  const netAssets = totalAssets - liabilities;
                  return (
                    <td key={year} className={`px-4 py-2 text-right text-sm ${netAssets >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {netAssets}万円
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderCorporateTable = () => {
    const sections = [
      { title: '収入', dataType: 'income' as const, expanded: expandedSections.corporateIncome },
      { title: '支出', dataType: 'expense' as const, expanded: expandedSections.corporateExpense },
      { title: '資産', dataType: 'asset' as const, expanded: expandedSections.corporateAsset },
      { title: '負債', dataType: 'liability' as const, expanded: expandedSections.corporateLiability },
    ];

    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">法人キャッシュフロー</h3>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-sm font-medium text-gray-500 sticky left-0 bg-gray-50">項目</th>
                {years.map(year => (
                  <th key={year} className="px-4 py-2 text-right text-sm font-medium text-gray-500">
                    {year}年
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              <tr>
                <td className="px-4 py-2 text-sm text-gray-900 sticky left-0 bg-white">イベント</td>
                {years.map(year => (
                  <td key={year} className="px-4 py-2 text-right text-xs text-gray-600">
                    {getLifeEventDescription(year, basicInfo, lifeEvents, 'corporate')}
                  </td>
                ))}
              </tr>
              
              {/* 各セクションをレンダリング */}
              {sections.map(section => (
                <React.Fragment key={section.title}>
                  {/* セクションヘッダー */}
                  <tr className="bg-blue-50 cursor-pointer" onClick={() => toggleSection(`corporate${section.dataType.charAt(0).toUpperCase() + section.dataType.slice(1)}` as keyof typeof expandedSections)}>
                    <td colSpan={years.length + 1} className="px-4 py-2 sticky left-0 bg-blue-50">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-blue-800">{section.title}</span>
                        {section.expanded ? 
                          <ChevronUp className="h-4 w-4 text-blue-800" /> : 
                          <ChevronDown className="h-4 w-4 text-blue-800" />
                        }
                      </div>
                    </td>
                  </tr>
                  
                  {section.expanded && (
                    <>
                      {/* カテゴリーフィルター */}
                      <tr>
                        <td colSpan={years.length + 1} className="px-4 py-2 bg-gray-50 sticky left-0">
                          {renderCategoryFilters(section.dataType)}
                        </td>
                      </tr>
                      
                      {/* カテゴリーごとにグループ化したアイテム */}
                      {(() => {
                        const { groups, categories } = getCategoryGroups('corporate', section.dataType);
                        
                        // カテゴリーごとのレンダリング
                        return Object.entries(groups).map(([categoryId, items]) => (
                          <React.Fragment key={categoryId}>
                            {/* カテゴリーヘッダー */}
                            {renderCategoryHeader(categoryId, categories, items.length)}
                            
                            {/* カテゴリー内の項目 */}
                            {items.map(item => (
                              <tr key={item.id}>
                                <td className="px-4 py-2 text-sm text-gray-900 sticky left-0 bg-white">
                                  <div className="flex items-center">
                                    <span className="w-2 h-2 rounded-full mr-2" style={{ backgroundColor: getCategoryColor(categoryId) }}></span>
                                    {item.name}（万円）
                                  </div>
                                </td>
                                {years.map(year => (
                                  <td key={year} className="px-4 py-2 text-right text-sm">
                                    <input
                                      type="number"
                                      value={item.amounts[year] || ''}
                                      onChange={(e) => {
                                        const value = e.target.value === '' ? 0 : Number(e.target.value);
                                        if (!isNaN(value)) {
                                          item.amounts[year] = value;
                                          syncCashFlowFromFormData();
                                        }
                                      }}
                                      className={inputStyle}
                                    />
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </React.Fragment>
                        ));
                      })()}
                    </>
                  )}
                </React.Fragment>
              ))}
              
              {/* 合計値 */}
              <tr className="bg-gray-50 font-medium">
                <td className="px-4 py-2 text-sm text-gray-900 sticky left-0 bg-gray-50">収支</td>
                {years.map(year => {
                  const balance = cashFlow[year]?.corporateBalance || 0;
                  return (
                    <td key={year} className={`px-4 py-2 text-right text-sm ${balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {balance}万円
                    </td>
                  );
                })}
              </tr>
              <tr className="bg-gray-50 font-medium">
                <td className="px-4 py-2 text-sm text-gray-900 sticky left-0 bg-gray-50">総資産</td>
                {years.map(year => {
                  const assets = cashFlow[year]?.corporateTotalAssets || 0;
                  return (
                    <td key={year} className={`px-4 py-2 text-right text-sm ${assets >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {assets}万円
                    </td>
                  );
                })}
              </tr>
              <tr className="bg-gray-50 font-medium">
                <td className="px-4 py-2 text-sm text-gray-900 sticky left-0 bg-gray-50">純資産</td>
                {years.map(year => {
                  const totalAssets = cashFlow[year]?.corporateTotalAssets || 0;
                  const liabilities = liabilityData.corporate.reduce((total, liability) => {
                    return total + (liability.amounts[year] || 0);
                  }, 0);
                  const netAssets = totalAssets - liabilities;
                  return (
                    <td key={year} className={`px-4 py-2 text-right text-sm ${netAssets >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {netAssets}万円
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold">キャッシュフロー</h2>
        <div className="flex gap-2">
          <button
            onClick={() => {
              // すべてのカテゴリーを表示
              setAllCategoriesDisplay('income', true);
              setAllCategoriesDisplay('expense', true);
              setAllCategoriesDisplay('asset', true);
              setAllCategoriesDisplay('liability', true);
            }}
            className="flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 rounded hover:bg-blue-200 text-sm"
          >
            <Eye className="h-4 w-4" />
            すべて表示
          </button>
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600"
          >
            <Download className="h-4 w-4" />
            CSVエクスポート
          </button>
        </div>
      </div>

      <div className="space-y-8">
        {renderPersonalTable()}
        {renderCorporateTable()}
      </div>

      <div className="flex justify-between space-x-4">
        <button
          type="button"
          onClick={handleBack}
          className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600"
        >
          戻る
        </button>
        <button
          type="button"
          onClick={handleNext}
          className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
        >
          次へ
        </button>
      </div>
    </div>
  );
}