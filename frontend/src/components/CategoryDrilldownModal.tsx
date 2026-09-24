import React from 'react';
import { CategoryDrilldownView } from './CategoryDrilldownView';

interface CategoryDrilldownModalProps {
  isOpen: boolean;
  onClose: () => void;
  categoryId?: number | null;
  accountName?: string;
  fromDate?: string;
  toDate?: string;
  propertyId?: number;
  classId?: number;
  companyId?: number;
  title?: string;
}

export const CategoryDrilldownModal: React.FC<CategoryDrilldownModalProps> = ({
  isOpen,
  onClose,
  categoryId,
  accountName,
  fromDate,
  toDate,
  propertyId,
  classId,
  companyId,
  title
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-5xl h-[85vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
        <CategoryDrilldownView
          categoryId={categoryId}
          accountName={accountName}
          fromDate={fromDate}
          toDate={toDate}
          propertyId={propertyId}
          classId={classId}
          companyId={companyId}
          title={title}
          onClose={onClose}
        />
      </div>
    </div>
  );
};
