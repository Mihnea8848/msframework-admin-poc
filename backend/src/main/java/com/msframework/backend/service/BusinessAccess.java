package com.msframework.backend.service;

import com.msframework.backend.config.Permission;
import com.msframework.backend.config.SystemRoles;
import com.msframework.backend.entity.Department;
import com.msframework.backend.entity.Expense;
import com.msframework.backend.entity.Goal;
import com.msframework.backend.entity.User;
import com.msframework.backend.exception.ApiException;

import java.util.Objects;

/**
 * Department scoping for budgets, expenses and goals. Permissions say what someone may do; these
 * rules say where:
 * <ul>
 *   <li>FINANCE_MANAGE works on every department (approve, pay, budgets, categories);</li>
 *   <li>EXPENSE_APPROVE alone approves only the user's own department;</li>
 *   <li>GOALS_MANAGE works on every department for admins and on their own department otherwise;</li>
 *   <li>members (GOALS_READ) record check-ins for their own department's goals;</li>
 *   <li>nobody approves or rejects their own expense.</li>
 * </ul>
 */
public final class BusinessAccess {

    private BusinessAccess() {
    }

    public static Long departmentId(User user) {
        return user.getDepartment() != null ? user.getDepartment().getId() : null;
    }

    public static boolean inDepartment(User user, Department department) {
        Long own = departmentId(user);
        return own != null && department != null && own.equals(department.getId());
    }

    public static boolean isAdmin(User user) {
        return user.hasRole(SystemRoles.ADMIN);
    }

    /** Requires at least one of the permissions. */
    public static void requireAny(User user, Permission... permissions) {
        for (Permission permission : permissions) {
            if (user.hasPermission(permission)) return;
        }
        throw ApiException.forbidden("You do not have permission to do this (" + permissions[0] + ")");
    }

    // ------------------------------------------------------------------ expenses

    public static boolean isSubmitter(User user, Expense expense) {
        return Objects.equals(expense.getSubmittedById(), user.getId());
    }

    /** Whether the user may see this expense at all. */
    public static boolean canView(User user, Expense expense) {
        return user.hasPermission(Permission.FINANCE_READ)
                || isSubmitter(user, expense)
                || (user.hasPermission(Permission.EXPENSE_APPROVE) && inDepartment(user, expense.getDepartment()));
    }

    /** Whether the user may file an expense for this department. */
    public static boolean canSubmitFor(User user, Department department) {
        if (user.hasPermission(Permission.FINANCE_MANAGE)) return true;
        return user.hasPermission(Permission.EXPENSE_SUBMIT) && inDepartment(user, department);
    }

    /** Whether the user may approve or reject this expense (status aside). */
    public static boolean canDecide(User user, Expense expense) {
        if (isSubmitter(user, expense)) return false;
        if (user.hasPermission(Permission.FINANCE_MANAGE)) return true;
        return user.hasPermission(Permission.EXPENSE_APPROVE) && inDepartment(user, expense.getDepartment());
    }

    // ------------------------------------------------------------------ goals

    public static boolean canManageGoals(User user, Department department) {
        if (!user.hasPermission(Permission.GOALS_MANAGE)) return false;
        return isAdmin(user) || inDepartment(user, department);
    }

    public static boolean canCheckIn(User user, Goal goal) {
        if (canManageGoals(user, goal.getDepartment())) return true;
        return user.hasPermission(Permission.GOALS_READ) && inDepartment(user, goal.getDepartment());
    }
}
