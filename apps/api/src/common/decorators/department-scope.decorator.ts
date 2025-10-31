import { SetMetadata } from '@nestjs/common';

export const DEPARTMENT_PARAM_KEY = 'departmentParamKey';
export const DepartmentScoped = (paramKey: string) => SetMetadata(DEPARTMENT_PARAM_KEY, paramKey);
