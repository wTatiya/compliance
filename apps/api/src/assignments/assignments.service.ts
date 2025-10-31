import { Injectable } from '@nestjs/common';

@Injectable()
export class AssignmentsService {
  listAssignments(departmentId: string) {
    return {
      departmentId,
      assignments: []
    };
  }
}
