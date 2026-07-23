---- MODULE SyntaxError ----
EXTENDS Naturals
VARIABLES n

(*
  @system      smoketest
  @requirement null
  @design      null
  @parent      null
  @sibling     null
  @child       null
  @level       L1
  @phase       1
*)

Init == n = 0
Next == n' = n + 1
Spec == Init [][Next]_n
====
