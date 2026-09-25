import React, { useState, useRef, useEffect } from 'react';
import { 
  Minimize2, 
  Maximize2, 
  X, 
  Minus, 
  LayoutGrid, 
  Columns, 
  Rows, 
  Layers, 
  Plus, 
  BarChart3, 
  BookOpen, 
  Scale, 
  CheckSquare, 
  Users, 
  FileSpreadsheet, 
  ListFilter, 
  Move,
  RotateCcw,
  Landmark
} from 'lucide-react';
import { WorkspaceWindow, WindowType, Company, Property, ClassEntity, Category, Vendor, CheckRecord, AppTheme } from '../../types';
import { FinancialDashboard } from '../../pages/FinancialDashboard';
import { ChartOfAccounts } from '../../pages/ChartOfAccounts';
import { JournalEntriesPage } from '../../pages/JournalEntriesPage';
import { CheckRegisterPage } from '../../pages/CheckRegisterPage';
import { VendorListPage } from '../../pages/VendorListPage';
import { StatementImportPortal } from '../../pages/StatementImportPortal';
import { TransactionsList } from '../../pages/TransactionsList';
import { PropertiesManager } from '../../pages/PropertiesManager';
import { CategoryDrilldownView } from '../CategoryDrilldownView';
import { EntitySetupWizardModal } from '../entities/EntitySetupWizardModal';

interface MultiWindowManagerProps {
  windows: WorkspaceWindow[];
  setWindows: React.Dispatch<React.SetStateAction<WorkspaceWindow[]>>;
  activeWindowId: string | null;
  setActiveWindowId: (id: string | null) => void;
  onOpenWriteCheckModal: (vendor?: Vendor) => void;
  onOpenMakeJournalModal: () => void;
  onOpenManualModal: () => void;
  onPrintCheck: (check: CheckRecord) => void;
  companies: Company[];
  classes: ClassEntity[];
  properties: Property[];
  categories: Category[];
  activeCompanyName: string;
  onRefreshMetadata: () => void;
  theme?: AppTheme;
}

export const MultiWindowManager: React.FC<MultiWindowManagerProps> = ({
  windows,
  setWindows,
  activeWindowId,
  setActiveWindowId,
  onOpenWriteCheckModal,
  onOpenMakeJournalModal,
  onOpenManualModal,
  onPrintCheck,
  companies,
  classes,
  properties,
  categories,
  activeCompanyName,
  onRefreshMetadata,
  theme = 'dark'
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [resizingId, setResizingId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [resizeStart, setResizeStart] = useState<{ x: number; y: number; w: number; h: number }>({ x: 0, y: 0, w: 0, h: 0 });
  const [isEntityWizardOpen, setIsEntityWizardOpen] = useState(false);

  // Focus and bring window to front
  const focusWindow = (id: string) => {
    setActiveWindowId(id);
    setWindows(prev => {
      const maxZ = prev.reduce((max, w) => Math.max(max, w.zIndex || 1), 1);
      return prev.map(w => w.id === id ? { ...w, zIndex: maxZ + 1, isMinimized: false } : w);
    });
  };

  // Window Controls
  const closeWindow = (id: string) => {
    setWindows(prev => prev.filter(w => w.id !== id));
    if (activeWindowId === id) {
      const remaining = windows.filter(w => w.id !== id);
      setActiveWindowId(remaining.length > 0 ? remaining[remaining.length - 1].id : null);
    }
  };

  const toggleMinimize = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setWindows(prev => prev.map(w => w.id === id ? { ...w, isMinimized: !w.isMinimized } : w));
  };

  const toggleMaximize = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setWindows(prev => prev.map(w => w.id === id ? { ...w, isMaximized: !w.isMaximized, isMinimized: false } : w));
  };

  // Dragging logic
  const handleMouseDownHeader = (id: string, e: React.MouseEvent) => {
    focusWindow(id);
    const win = windows.find(w => w.id === id);
    if (!win || win.isMaximized) return;

    setDraggingId(id);
    setDragOffset({
      x: e.clientX - win.x,
      y: e.clientY - win.y
    });
  };

  // Resizing logic
  const handleMouseDownResize = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    focusWindow(id);
    const win = windows.find(w => w.id === id);
    if (!win || win.isMaximized) return;

    setResizingId(id);
    setResizeStart({
      x: e.clientX,
      y: e.clientY,
      w: win.width,
      h: win.height
    });
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (draggingId) {
        setWindows(prev => prev.map(w => {
          if (w.id === draggingId && !w.isMaximized) {
            const newX = Math.max(0, e.clientX - dragOffset.x);
            const newY = Math.max(0, e.clientY - dragOffset.y);
            return { ...w, x: newX, y: newY };
          }
          return w;
        }));
      } else if (resizingId) {
        setWindows(prev => prev.map(w => {
          if (w.id === resizingId && !w.isMaximized) {
            const dx = e.clientX - resizeStart.x;
            const dy = e.clientY - resizeStart.y;
            const newW = Math.max(420, resizeStart.w + dx);
            const newH = Math.max(300, resizeStart.h + dy);
            return { ...w, width: newW, height: newH };
          }
          return w;
        }));
      }
    };

    const handleMouseUp = () => {
      setDraggingId(null);
      setResizingId(null);
    };

    if (draggingId || resizingId) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [draggingId, resizingId, dragOffset, resizeStart]);

  // Layout Arrangers (Tile Horizontally, Tile Vertically, Cascade)
  const tileHorizontally = () => {
    const container = containerRef.current;
    if (!container || windows.length === 0) return;
    const { clientWidth, clientHeight } = container;
    const activeList = windows.filter(w => !w.isMinimized);
    const count = activeList.length || 1;
    const widthPerWin = Math.floor(clientWidth / count);

    setWindows(prev => prev.map((w, idx) => {
      const activeIdx = activeList.findIndex(a => a.id === w.id);
      if (activeIdx !== -1) {
        return {
          ...w,
          isMaximized: false,
          isMinimized: false,
          x: activeIdx * widthPerWin,
          y: 0,
          width: widthPerWin - 4,
          height: clientHeight - 44
        };
      }
      return w;
    }));
  };

  const tileVertically = () => {
    const container = containerRef.current;
    if (!container || windows.length === 0) return;
    const { clientWidth, clientHeight } = container;
    const activeList = windows.filter(w => !w.isMinimized);
    const count = activeList.length || 1;
    const heightPerWin = Math.floor((clientHeight - 44) / count);

    setWindows(prev => prev.map((w, idx) => {
      const activeIdx = activeList.findIndex(a => a.id === w.id);
      if (activeIdx !== -1) {
        return {
          ...w,
          isMaximized: false,
          isMinimized: false,
          x: 0,
          y: activeIdx * heightPerWin,
          width: clientWidth,
          height: heightPerWin - 4
        };
      }
      return w;
    }));
  };

  const cascadeWindows = () => {
    setWindows(prev => prev.map((w, idx) => ({
      ...w,
      isMaximized: false,
      isMinimized: false,
      x: 30 + (idx * 35),
      y: 20 + (idx * 35),
      width: 780,
      height: 520,
      zIndex: idx + 1
    })));
  };

  const getWindowIcon = (type: WindowType) => {
    switch (type) {
      case 'dashboard': return <BarChart3 className="w-4 h-4 text-emerald-400" />;
      case 'accounts': return <BookOpen className="w-4 h-4 text-emerald-400" />;
      case 'journal': return <Scale className="w-4 h-4 text-cyan-400" />;
      case 'checks': return <CheckSquare className="w-4 h-4 text-emerald-400" />;
      case 'vendors': return <Users className="w-4 h-4 text-amber-400" />;
      case 'import': return <FileSpreadsheet className="w-4 h-4 text-emerald-400" />;
      case 'transactions': return <ListFilter className="w-4 h-4 text-emerald-400" />;
      case 'properties': return <Layers className="w-4 h-4 text-emerald-400" />;
      case 'category_drilldown': return <Layers className="w-4 h-4 text-emerald-400" />;
      default: return <Layers className="w-4 h-4 text-slate-400" />;
    }
  };

  const handleOpenCategoryDrilldown = (drillData: {
    categoryId?: number | null;
    accountName?: string;
    fromDate?: string;
    toDate?: string;
    propertyId?: number;
    classId?: number;
    companyId?: number;
    title?: string;
  }) => {
    const container = containerRef.current;
    const canvasW = container?.clientWidth || 1200;
    const canvasH = container?.clientHeight || 700;
    const winW = Math.min(1000, Math.max(760, canvasW - 80));
    const winH = Math.min(620, Math.max(480, canvasH - 80));
    const targetX = Math.max(30, Math.floor((canvasW - winW) / 2));
    const targetY = Math.max(30, Math.floor((canvasH - winH) / 2));

    const winTitle = drillData.title || `Ledger: ${drillData.accountName || 'Category Details'}`;

    setWindows(prev => {
      // Find the absolute highest z-index across ALL current windows
      const maxZ = prev.reduce((max, w) => Math.max(max, w.zIndex || 1), 1);
      const topZ = maxZ + 100;

      // Check if a category drilldown window already exists
      const existing = prev.find(w => w.type === 'category_drilldown');
      if (existing) {
        // Bring existing drilldown window to the front, unminimize it, and update its category/content
        setActiveWindowId(existing.id);
        setTimeout(() => setActiveWindowId(existing.id), 50);
        return prev.map(w => w.id === existing.id ? {
          ...w,
          title: winTitle,
          data: drillData,
          isMinimized: false,
          zIndex: topZ,
          x: w.isMinimized ? targetX : (w.x ?? targetX),
          y: w.isMinimized ? targetY : (w.y ?? targetY),
          width: Math.max(w.width, winW),
          height: Math.max(w.height, winH)
        } : w);
      }

      // Otherwise create a new drilldown window with top z-index, centered and active
      const newId = `drilldown_${Date.now()}`;
      setActiveWindowId(newId);
      setTimeout(() => setActiveWindowId(newId), 50);
      const newWin: WorkspaceWindow = {
        id: newId,
        type: 'category_drilldown',
        title: winTitle,
        x: targetX,
        y: targetY,
        width: winW,
        height: winH,
        zIndex: topZ,
        isMinimized: false,
        isMaximized: false,
        data: drillData
      };
      return [...prev, newWin];
    });
  };

  const renderWindowContent = (win: WorkspaceWindow) => {
    switch (win.type) {
      case 'dashboard':
        return (
          <FinancialDashboard
            companies={companies}
            classes={classes}
            properties={properties}
            onOpenManualModal={onOpenManualModal}
            onNavigateToImport={() => {}}
            onNavigateToHierarchy={onRefreshMetadata}
            onOpenCategoryDrilldown={handleOpenCategoryDrilldown}
          />
        );
      case 'category_drilldown':
        return (
          <CategoryDrilldownView
            categoryId={win.data?.categoryId}
            accountName={win.data?.accountName}
            fromDate={win.data?.fromDate}
            toDate={win.data?.toDate}
            propertyId={win.data?.propertyId}
            classId={win.data?.classId}
            companyId={win.data?.companyId}
            title={win.data?.title}
            onClose={() => closeWindow(win.id)}
          />
        );
      case 'accounts':
        return <ChartOfAccounts activeCompanyName={activeCompanyName} onAccountsChange={onRefreshMetadata} />;
      case 'journal':
        return (
          <JournalEntriesPage
            onOpenMakeJournalModal={onOpenMakeJournalModal}
            classes={classes}
            properties={properties}
          />
        );
      case 'checks':
        return (
          <CheckRegisterPage
            onOpenWriteCheckModal={() => onOpenWriteCheckModal()}
            onPrintCheck={onPrintCheck}
            categories={categories}
            properties={properties}
            classes={classes}
          />
        );
      case 'vendors':
        return (
          <VendorListPage
            onWriteCheckToVendor={(v) => onOpenWriteCheckModal(v)}
            categories={categories}
          />
        );
      case 'import':
        return (
          <StatementImportPortal
            properties={properties}
            classes={classes}
            categories={categories}
            onImportSuccess={onRefreshMetadata}
          />
        );
      case 'transactions':
        return (
          <TransactionsList
            properties={properties}
            classes={classes}
            onOpenManualModal={onOpenManualModal}
          />
        );
      case 'properties':
        return (
          <PropertiesManager
            companies={companies}
            classes={classes}
            properties={properties}
            onRefresh={onRefreshMetadata}
            theme={theme}
          />
        );
      default:
        return <div className="p-6 text-slate-400">Empty Window Content</div>;
    }
  };

  const isLight = theme === 'light';
  const isNavy = theme === 'navy';
  const isEmerald = theme === 'emerald';

  const topToolbarClass = isLight
    ? 'bg-white border-b border-slate-200 px-4 py-2 flex items-center justify-between z-30 shrink-0 text-slate-800 shadow-2xs'
    : isNavy
    ? 'bg-[#0a1124] border-b border-blue-900/60 px-4 py-2 flex items-center justify-between z-30 shrink-0 text-white'
    : isEmerald
    ? 'bg-[#041710] border-b border-emerald-900/60 px-4 py-2 flex items-center justify-between z-30 shrink-0 text-white'
    : 'bg-slate-900 border-b border-slate-800 px-4 py-2 flex items-center justify-between z-30 shrink-0 text-white';

  const toolbarBtnClass = isLight
    ? 'flex items-center space-x-1 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:text-slate-950 bg-white hover:bg-slate-50 rounded-lg border border-slate-300 shadow-2xs transition cursor-pointer'
    : 'flex items-center space-x-1 px-2.5 py-1 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 transition cursor-pointer';

  const entitySetupBtnClass = isLight
    ? 'flex items-center space-x-1 px-2.5 py-1 text-xs font-semibold text-emerald-800 hover:text-emerald-950 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-300 transition cursor-pointer'
    : 'flex items-center space-x-1 px-2.5 py-1 text-xs font-semibold text-emerald-300 hover:text-white bg-emerald-950/80 hover:bg-emerald-900/80 rounded-lg border border-emerald-700/60 transition cursor-pointer';

  const badgeClass = isLight
    ? 'text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-emerald-800 border border-slate-300 font-bold'
    : 'text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-emerald-300 border border-slate-700';

  const bottomDockClass = isLight
    ? 'bg-white border-t border-slate-200 px-4 py-1.5 flex items-center space-x-2 overflow-x-auto z-40 shrink-0 h-10 shadow-2xs'
    : isNavy
    ? 'bg-[#0a1124] border-t border-blue-900/60 px-4 py-1.5 flex items-center space-x-2 overflow-x-auto z-40 shrink-0 h-10'
    : isEmerald
    ? 'bg-[#041710] border-t border-emerald-900/60 px-4 py-1.5 flex items-center space-x-2 overflow-x-auto z-40 shrink-0 h-10'
    : 'bg-slate-900 border-t border-slate-800 px-4 py-1.5 flex items-center space-x-2 overflow-x-auto z-40 shrink-0 h-10';

  const getWindowCardClass = (isActive: boolean) => {
    if (isLight) {
      return `flex flex-col bg-white border rounded-xl shadow-2xl overflow-hidden transition-shadow ${
        isActive 
          ? 'border-emerald-600 shadow-xl ring-2 ring-emerald-500/30' 
          : 'border-slate-300 shadow-md'
      }`;
    }
    if (isNavy) {
      return `flex flex-col bg-[#0f1b33] border rounded-xl shadow-2xl overflow-hidden transition-shadow ${
        isActive 
          ? 'border-blue-500/80 shadow-blue-950/40 ring-1 ring-blue-500/50' 
          : 'border-blue-900/80 shadow-black/60'
      }`;
    }
    if (isEmerald) {
      return `flex flex-col bg-[#07261b] border rounded-xl shadow-2xl overflow-hidden transition-shadow ${
        isActive 
          ? 'border-emerald-500/80 shadow-emerald-950/40 ring-1 ring-emerald-500/50' 
          : 'border-emerald-900/80 shadow-black/60'
      }`;
    }
    return `flex flex-col bg-slate-900 border rounded-xl shadow-2xl overflow-hidden transition-shadow ${
      isActive 
        ? 'border-emerald-500/80 shadow-emerald-950/40 ring-1 ring-emerald-500/50' 
        : 'border-slate-700/80 shadow-black/60'
    }`;
  };

  const getHeaderBarClass = (isActive: boolean) => {
    if (isLight) {
      return `px-3 py-2 border-b flex items-center justify-between cursor-move select-none ${
        isActive 
          ? 'bg-gradient-to-r from-slate-100 via-slate-50 to-slate-100 border-slate-300' 
          : 'bg-slate-50 border-slate-200'
      }`;
    }
    if (isNavy) {
      return `px-3 py-2 border-b flex items-center justify-between cursor-move select-none ${
        isActive 
          ? 'bg-gradient-to-r from-[#142343] to-[#0f1b33] border-blue-800' 
          : 'bg-[#0c1527] border-blue-900'
      }`;
    }
    if (isEmerald) {
      return `px-3 py-2 border-b flex items-center justify-between cursor-move select-none ${
        isActive 
          ? 'bg-gradient-to-r from-[#0b3325] to-[#07261b] border-emerald-800' 
          : 'bg-[#051c14] border-emerald-900'
      }`;
    }
    return `px-3 py-2 border-b flex items-center justify-between cursor-move select-none ${
      isActive 
        ? 'bg-gradient-to-r from-slate-800 via-slate-800 to-slate-900 border-slate-700' 
        : 'bg-slate-900/90 border-slate-800'
    }`;
  };

  const getWindowTitleClass = (isActive: boolean) => {
    if (isLight) {
      return `text-xs font-bold truncate ${isActive ? 'text-slate-900' : 'text-slate-600'}`;
    }
    return `text-xs font-bold truncate ${isActive ? 'text-white' : 'text-slate-400'}`;
  };

  const windowBodyClass = isLight
    ? 'flex-1 overflow-y-auto p-4 bg-white text-slate-900'
    : isNavy
    ? 'flex-1 overflow-y-auto p-4 bg-[#0f1b33] text-slate-100'
    : isEmerald
    ? 'flex-1 overflow-y-auto p-4 bg-[#07261b] text-slate-100'
    : 'flex-1 overflow-y-auto p-4 bg-slate-900/95 text-slate-100';

  const windowControlBtnClass = isLight
    ? 'p-1 rounded text-slate-500 hover:text-slate-900 hover:bg-slate-200 transition cursor-pointer'
    : 'p-1 rounded text-slate-400 hover:text-white hover:bg-slate-700 transition cursor-pointer';

  return (
    <div className={`relative w-full flex-1 min-h-0 h-[calc(100vh-5rem)] flex flex-col overflow-hidden select-none ${
      isLight ? 'bg-slate-100' : isNavy ? 'bg-[#080e1e]' : isEmerald ? 'bg-[#03140e]' : 'bg-slate-950'
    }`}>
      
      {/* Top Multi-Window Desktop Toolbar */}
      <div className={topToolbarClass}>
        <div className="flex items-center space-x-2">
          <span className={`text-xs font-bold uppercase tracking-wider flex items-center space-x-1.5 ${isLight ? 'text-slate-700' : 'text-slate-400'}`}>
            <LayoutGrid className="w-3.5 h-3.5 text-emerald-500" />
            <span>Desktop Workspace</span>
          </span>
          <span className={badgeClass}>
            {windows.filter(w => !w.isMinimized).length} Active / {windows.length} Open
          </span>
        </div>

        {/* Layout Tools */}
        <div className="flex items-center space-x-1.5">
          <button
            onClick={tileHorizontally}
            className={toolbarBtnClass}
            title="Tile Windows Side-by-Side"
          >
            <Columns className="w-3 h-3 text-cyan-500" />
            <span className="hidden sm:inline">Tile Side-by-Side</span>
          </button>

          <button
            onClick={tileVertically}
            className={toolbarBtnClass}
            title="Tile Windows Vertically"
          >
            <Rows className="w-3 h-3 text-emerald-500" />
            <span className="hidden sm:inline">Tile Vertically</span>
          </button>

          <button
            onClick={cascadeWindows}
            className={toolbarBtnClass}
            title="Cascade Windows in Stairs"
          >
            <Layers className="w-3 h-3 text-amber-500" />
            <span className="hidden sm:inline">Cascade</span>
          </button>

          <div className={`h-4 w-px mx-1 ${isLight ? 'bg-slate-300' : 'bg-slate-700'}`} />

          <button
            onClick={() => setIsEntityWizardOpen(true)}
            className={entitySetupBtnClass}
            title="Launch Guided Entity & Portfolio Setup Interview"
          >
            <Landmark className="w-3 h-3 text-emerald-500" />
            <span>+ Entity Setup</span>
          </button>
        </div>
      </div>

      {/* The Floating Canvas Workspace */}
      <div 
        ref={containerRef}
        className={`relative flex-1 w-full h-full overflow-hidden [background-size:24px_24px] ${
          theme === 'light'
            ? 'bg-slate-100 bg-[radial-gradient(#cbd5e1_1.5px,transparent_1.5px)]'
            : theme === 'navy'
            ? 'bg-[#080e1e] bg-[radial-gradient(#1e3a6a_1.5px,transparent_1.5px)]'
            : theme === 'emerald'
            ? 'bg-[#03140e] bg-[radial-gradient(#145942_1.5px,transparent_1.5px)]'
            : 'bg-slate-950 bg-[radial-gradient(#1e293b_1px,transparent_1px)]'
        }`}
      >
        {windows.map((win) => {
          const isActive = activeWindowId === win.id;
          if (win.isMinimized) return null;

          return (
            <div
              key={win.id}
              onClick={() => focusWindow(win.id)}
              style={{
                position: 'absolute',
                left: win.isMaximized ? 0 : `${win.x}px`,
                top: win.isMaximized ? 0 : `${win.y}px`,
                width: win.isMaximized ? '100%' : `${win.width}px`,
                height: win.isMaximized ? 'calc(100% - 40px)' : `${win.height}px`,
                zIndex: win.zIndex || 1,
              }}
              className={getWindowCardClass(isActive)}
            >
              {/* Window Header Title Bar (Draggable) */}
              <div
                onMouseDown={(e) => handleMouseDownHeader(win.id, e)}
                onDoubleClick={(e) => toggleMaximize(win.id, e)}
                className={getHeaderBarClass(isActive)}
              >
                <div className="flex items-center space-x-2 truncate">
                  {getWindowIcon(win.type)}
                  <span className={getWindowTitleClass(isActive)}>
                    {win.title}
                  </span>
                </div>

                {/* Window Actions: Minimize, Maximize / Restore, Close */}
                <div className="flex items-center space-x-1 ml-2 shrink-0">
                  <button
                    onClick={(e) => toggleMinimize(win.id, e)}
                    className={windowControlBtnClass}
                    title="Minimize"
                  >
                    <Minus className="w-3 h-3" />
                  </button>

                  <button
                    onClick={(e) => toggleMaximize(win.id, e)}
                    className={windowControlBtnClass}
                    title={win.isMaximized ? 'Restore Window' : 'Maximize to Full Screen'}
                  >
                    {win.isMaximized ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
                  </button>

                  <button
                    onClick={(e) => { e.stopPropagation(); closeWindow(win.id); }}
                    className={`p-1 rounded transition cursor-pointer ${
                      isLight ? 'text-slate-400 hover:text-rose-600 hover:bg-rose-50' : 'text-slate-400 hover:text-rose-400 hover:bg-rose-500/20'
                    }`}
                    title="Close Window"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* Window Scrollable Body Content */}
              <div className={windowBodyClass}>
                {renderWindowContent(win)}
              </div>

              {/* Window Resize Handle */}
              {!win.isMaximized && (
                <div
                  onMouseDown={(e) => handleMouseDownResize(win.id, e)}
                  className={`absolute bottom-0 right-0 w-4 h-4 cursor-se-resize flex items-center justify-center ${
                    isLight ? 'text-slate-400 hover:text-emerald-600' : 'text-slate-500 hover:text-emerald-400'
                  }`}
                  title="Drag to Resize"
                >
                  <div className={`w-2 h-2 border-r-2 border-b-2 ${
                    isLight ? 'border-slate-400 hover:border-emerald-600' : 'border-slate-500 hover:border-emerald-400'
                  }`} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Bottom Desktop Taskbar / Open Windows Dock */}
      <div className={bottomDockClass}>
        <span className={`text-[11px] font-bold uppercase tracking-wider shrink-0 mr-1 ${
          isLight ? 'text-slate-600' : 'text-slate-400'
        }`}>
          Open Windows:
        </span>

        {windows.map((win) => {
          const isActive = activeWindowId === win.id && !win.isMinimized;
          return (
            <button
              key={win.id}
              onClick={() => {
                if (win.isMinimized) {
                  focusWindow(win.id);
                } else if (isActive) {
                  toggleMinimize(win.id);
                } else {
                  focusWindow(win.id);
                }
              }}
              className={`flex items-center space-x-1.5 px-3 py-1 rounded-lg text-xs font-semibold border transition shrink-0 cursor-pointer ${
                isLight
                  ? isActive
                    ? 'bg-emerald-600 text-white border-emerald-500 shadow-2xs font-bold'
                    : win.isMinimized
                    ? 'bg-slate-100/70 text-slate-400 border-slate-200 hover:bg-slate-100 hover:text-slate-600'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50 hover:text-slate-950 shadow-2xs'
                  : isActive
                  ? 'bg-emerald-600 text-white border-emerald-500 shadow-sm font-bold'
                  : win.isMinimized
                  ? 'bg-slate-800/50 text-slate-400 border-slate-800 hover:bg-slate-800 hover:text-slate-300'
                  : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700 hover:text-white'
              }`}
            >
              {getWindowIcon(win.type)}
              <span className="truncate max-w-32">{win.title}</span>
              {win.isMinimized && <span className={`text-[9px] font-bold ${isLight ? 'text-amber-600' : 'text-amber-400'}`}>(min)</span>}
            </button>
          );
        })}

        {windows.length === 0 && (
          <span className={`text-xs italic ${isLight ? 'text-slate-500' : 'text-slate-500'}`}>No windows open. Click a navigation tab above to open a window.</span>
        )}
      </div>

      {/* Entity Setup Interview Wizard */}
      <EntitySetupWizardModal
        isOpen={isEntityWizardOpen}
        onClose={() => setIsEntityWizardOpen(false)}
        existingCompanies={companies}
        onSuccess={() => {
          onRefreshMetadata();
        }}
      />

    </div>
  );
};
