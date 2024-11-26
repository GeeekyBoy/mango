#![deny(clippy::all)]

use std::collections::{HashMap, HashSet};
use swc_common::{comments::Comments, Mark, Span, Spanned};
use swc_ecma_ast::*;
use swc_ecma_transforms::resolver;
use swc_ecma_utils::*;
use swc_ecma_visit::*;
use swc_plugin_macro::plugin_transform;
use swc_plugin_proxy::{PluginCommentsProxy, TransformPluginProgramMetadata};

#[derive(Default, Debug)]
struct ComponentProp {
  local_name: Id,
  deps: HashSet<Id>,
  common_value: Option<Expr>,
  is_used: bool,
  is_default: bool,
}

#[derive(Default, Debug)]
enum Annotation {
  #[default]
  NONE,
  EffectDeps,
  ImmediateEffectDeps,
  StateDeps,
  DynamicAttrs,
  DynamicViewDeps,
}

struct MainVisitor<C>
where
  C: Comments + Clone,
{
  comments: C,
  components: HashMap<Id, HashMap<Id, ComponentProp>>,
}

struct Round1Visitor<'a> {
  components: &'a mut HashMap<Id, HashMap<Id, ComponentProp>>,
}

struct Round2Visitor<'a, C>
where
  C: Comments,
{
  comments: C,
  components: &'a mut HashMap<Id, HashMap<Id, ComponentProp>>,
  const_props_usages: HashMap<Id, bool>,
}

impl<C> Round2Visitor<'_, C>
where
  C: Comments,
{
  fn get_annotation(&mut self, span: Span) -> Annotation {
    if let Some(comments) = self.comments.get_leading(span.lo()) {
      if let Some(comment) = comments.first() {
        return if comment.text == " EFFECT_DEPS " {
          Annotation::EffectDeps
        } else if comment.text == " IMMEDIATE_EFFECT_DEPS " {
          Annotation::ImmediateEffectDeps
        } else if comment.text == " STATE_DEPS " {
          Annotation::StateDeps
        } else if comment.text == " DYNAMIC_ATTRS " {
          Annotation::DynamicAttrs
        } else if comment.text == " DYNAMIC_VIEW_DEPS " {
          Annotation::DynamicViewDeps
        } else {
          Annotation::NONE
        };
      }
      return Annotation::NONE;
    }
    return Annotation::NONE;
  }
  fn clean_deps_array(&mut self, array_expr: &ArrayLit) -> Vec<Option<ExprOrSpread>> {
    let mut new_elems = vec![];
    for elem in &array_expr.elems {
      if let Some(ExprOrSpread { expr: n, .. }) = elem {
        if let Expr::Cond(CondExpr { cons, .. }) = &**n {
          if let Expr::Ident(ident) = &**cons {
            if !self.const_props_usages.contains_key(&ident.to_id()) {
              new_elems.push(elem.clone());
            }
          }
        } else if let Expr::Ident(ident) = &**n {
          if !self.const_props_usages.contains_key(&ident.to_id()) {
            new_elems.push(elem.clone());
          }
        } else {
          new_elems.push(elem.clone());
        }
      }
    }
    return new_elems;
  }
}

impl<C> VisitMut for MainVisitor<C>
where
  C: Comments + Clone,
{
  fn visit_mut_program(&mut self, expr: &mut Program) {
    expr.visit_children_with(&mut Round1Visitor {
      components: &mut self.components,
    });
    let mut const_props_usages: HashMap<Id, bool> = Default::default();
    loop {
      let old_size = const_props_usages.len();
      const_props_usages = self
        .components
        .iter()
        .flat_map(|(_, props)| {
          props
            .iter()
            .filter(|(_, prop)| prop.deps.is_empty() || !prop.is_used || !prop.common_value.is_none())
            .map(|(_, prop)| (prop.local_name.clone(), prop.is_default))
        })
        .collect();
      let new_size = const_props_usages.len();
      if new_size == old_size {
        break;
      }
      for (_, props) in &mut self.components {
        for (_, prop) in props {
          if !prop.deps.is_empty() {
            let mut new_deps = HashSet::new();
            for dep in &prop.deps {
              if !const_props_usages.contains_key(dep) {
                new_deps.insert(dep.clone());
              }
            }
            prop.deps = new_deps;
          }
        }
      }
    }
    expr.visit_mut_children_with(&mut Round2Visitor {
      comments: self.comments.clone(),
      const_props_usages,
      components: &mut self.components,
    });
  }
}

impl<C> VisitMut for Round2Visitor<'_, C>
where
  C: Comments,
{
  fn visit_mut_array_lit(&mut self, n: &mut ArrayLit) {
    n.visit_mut_children_with(self);
    let array_annotation = self.get_annotation(n.span);
    if let Annotation::StateDeps = array_annotation {
      n.elems = self.clean_deps_array(n);
    } else if let Annotation::DynamicAttrs = array_annotation {
      n.elems = self.clean_deps_array(n);
    }
  }
  fn visit_mut_call_expr(&mut self, n: &mut CallExpr) {
    n.visit_mut_children_with(self);
    let callee = &n.callee;
    let params = &mut n.args;
    if let Callee::Expr(callee) = callee {
      if let Expr::Ident(callee) = &**callee {
        if self.components.contains_key(&callee.to_id()) {
          if let Some(component_info) = self.components.get_mut(&callee.to_id()) {
            if let Some(ExprOrSpread { expr: n, .. }) = &mut params.get_mut(0) {
              if let Expr::Object(n) = &mut **n {
                for prop in &mut n.props {
                  if let PropOrSpread::Prop(prop) = prop {
                    if let Prop::KeyValue(prop) = &mut **prop {
                      if let PropName::Ident(prop_name) = &prop.key {
                        if let Some(prop_info) = component_info.get_mut(&(prop_name.sym.clone(), Default::default())) {
                          if prop_info.deps.is_empty() {
                            if let Expr::Call(expr) = &*prop.value {
                              if let Some(ExprOrSpread { expr: n, .. }) = &expr.args.get(0) {
                                if let Expr::Fn(FnExpr { function, .. }) = &**n {
                                  if let Some(block_stmt) = &function.body {
                                    if let Some(Stmt::Return(ReturnStmt { arg: Some(arg), .. })) =
                                      &block_stmt.stmts.get(0)
                                    {
                                      *prop.value = *arg.clone();
                                    }
                                  }
                                } else {
                                  *prop.value = *n.clone();
                                }
                              }
                            }
                          } else if let Expr::Ident(ident) = &*prop.value {
                            if let Some(_) = self.const_props_usages.get(&ident.to_id()) {
                              *prop.value = Expr::Array(ArrayLit {
                                elems: vec![Some(ExprOrSpread {
                                  expr: Box::new(Expr::Ident(ident.clone())),
                                  spread: None,
                                })],
                                span: prop.value.span(),
                              });
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
  fn visit_mut_expr(&mut self, n: &mut Expr) {
    let mut should_return = false;
    if let Expr::Cond(CondExpr { cons, .. }) = &n {
      if let Expr::Call(call_expr) = &**cons {
        let params = &call_expr.args;
        if let Some(ExprOrSpread {
          expr: pot_state_expr, ..
        }) = &params.get(0)
        {
          if let Expr::Ident(pot_state) = &**pot_state_expr {
            if self.const_props_usages.get(&pot_state.to_id()).eq(&Some(&true)) {
              *n = *pot_state_expr.clone();
              should_return = true;
            }
          }
        }
      }
    } else if let Expr::Call(call_expr) = &n {
      let params = &call_expr.args;
      if let Some(ExprOrSpread {
        expr: pot_state_expr, ..
      }) = &params.get(0)
      {
        if let Expr::Ident(pot_state) = &**pot_state_expr {
          if self.const_props_usages.contains_key(&pot_state.to_id()) {
            *n = *pot_state_expr.clone();
            should_return = true;
          }
        }
      }
    }
    if should_return {
      return;
    }
    n.visit_mut_children_with(self);
    if let Expr::Call(call_expr) = n {
      let params = &mut call_expr.args;
      if let Some(ExprOrSpread { expr, .. }) = &mut params.get_mut(1) {
        if let Expr::Array(array_expr) = &mut **expr {
          if array_expr.elems.len() > 0 {
            let array_annotation = self.get_annotation(array_expr.span);
            if let Annotation::EffectDeps = array_annotation {
              let new_elems = self.clean_deps_array(array_expr);
              if new_elems.len() == 0 {
                *n = Expr::Ident(quote_ident!("undefined").into());
              } else {
                *array_expr = ArrayLit {
                  elems: new_elems,
                  span: array_expr.span,
                };
              }
            } else if let Annotation::ImmediateEffectDeps = array_annotation {
              let new_elems = self.clean_deps_array(array_expr);
              if new_elems.len() == 0 {
                if let Some(ExprOrSpread { expr: effect, .. }) = &params.get(0) {
                  *n = Expr::Call(CallExpr {
                    callee: Callee::Expr(effect.clone()),
                    args: vec![],
                    span: call_expr.span,
                    type_args: None,
                    ctxt: call_expr.ctxt,
                  });
                }
              } else {
                *array_expr = ArrayLit {
                  elems: new_elems,
                  span: array_expr.span,
                };
              }
            } else if let Annotation::DynamicViewDeps = array_annotation {
              let new_elems = self.clean_deps_array(array_expr);
              if new_elems.len() == 0 {
                if let Some(ExprOrSpread { expr: view, .. }) = &params.get(0) {
                  if let Expr::Fn(FnExpr { function, .. }) = &**view {
                    if let Some(block_stmt) = &function.body {
                      if let Some(Stmt::Return(ReturnStmt { arg: Some(arg), .. })) = &block_stmt.stmts.get(0) {
                        *n = *arg.clone();
                      }
                    }
                  }
                }
              } else {
                *array_expr = ArrayLit {
                  elems: new_elems,
                  span: array_expr.span,
                };
              }
            }
          }
        }
      }
    } else if let Expr::Fn(FnExpr { function, .. }) = n {
      if let Some(block_stmt) = &mut function.body {
        if let Some(Stmt::Return(ReturnStmt { arg: Some(arg), .. })) = &mut block_stmt.stmts.get_mut(0) {
          if let Expr::Array(outer_array_expr) = &mut **arg {
            if let Some(Some(ExprOrSpread { expr, .. })) = &mut outer_array_expr.elems.get_mut(1) {
              if let Expr::Array(array_expr) = &mut **expr {
                let array_annotation = self.get_annotation(array_expr.span);
                if let Annotation::DynamicViewDeps = array_annotation {
                  let new_elems = self.clean_deps_array(array_expr);
                  if new_elems.len() == 0 {
                    if let Some(Some(ExprOrSpread { expr: view, .. })) = &outer_array_expr.elems.get_mut(0) {
                      if let Expr::Fn(FnExpr { function, .. }) = &**view {
                        if let Some(block_stmt) = &function.body {
                          if let Some(Stmt::Return(ReturnStmt { arg: Some(arg), .. })) = &block_stmt.stmts.get(0) {
                            *n = Expr::Array(ArrayLit {
                              elems: vec![Some(ExprOrSpread {
                                expr: arg.clone(),
                                spread: None,
                              })],
                              span: n.span(),
                            });
                          }
                        }
                      }
                    }
                  } else {
                    *array_expr = ArrayLit {
                      elems: new_elems,
                      span: array_expr.span,
                    };
                  }
                }
              }
            }
          }
        }
      }
    }
  }
  fn visit_mut_var_declarator(&mut self, n: &mut VarDeclarator) {
    n.visit_mut_children_with(self);
    if let Some(expr) = &mut n.init {
      if let Expr::Fn(FnExpr { function, .. }) = &mut **expr {
        if let Some(block_stmt) = &mut function.body {
          let is_component: bool = if let Some(Stmt::Expr(ExprStmt { expr, .. })) = &block_stmt.stmts.get(0) {
            if let Expr::Lit(Lit::Str(Str { value, .. })) = &**expr {
              value == "use mango_component"
            } else {
              false
            }
          } else {
            false
          };
          if is_component {
            if let Pat::Ident(BindingIdent { id, .. }) = &n.name {
              if let Some(props_info) = self.components.get(&id.to_id()) {
                if let Some(Stmt::Expr(ExprStmt { expr, .. })) = &block_stmt.stmts.get(1) {
                  if let Expr::Lit(Lit::Str(Str { value, .. })) = &**expr {
                    let props_count = value[4..].parse::<i32>().unwrap();
                    if props_count > 0 {
                      let mut curr_decl_pos = 2;
                      let mut prop_pos = 0;
                      'outer_loop: while prop_pos < props_count {
                        while !matches!(&block_stmt.stmts.get(curr_decl_pos), Some(Stmt::Decl(Decl::Var(_)))) {
                          curr_decl_pos += 1;
                          prop_pos += 1;
                          if prop_pos > props_count {
                            break 'outer_loop;
                          }
                        }
                        if let Some(Stmt::Decl(Decl::Var(n))) = &mut block_stmt.stmts.get_mut(curr_decl_pos) {
                          let mut pending_is_default = false;
                          for declaration in &mut n.decls {
                            if let VarDeclarator { init: Some(init), .. } = declaration {
                              if pending_is_default {
                                *init = Box::new(Expr::Ident(quote_ident!("false").into()));
                                pending_is_default = false;
                              } else if let Expr::Bin(BinExpr {
                                left,
                                op: op!("||"),
                                right,
                                ..
                              }) = &**init
                              {
                                if let Expr::Member(MemberExpr {
                                  prop: MemberProp::Ident(left_prop),
                                  ..
                                }) = &**left
                                {
                                  if let Some(prop_info) = props_info.get(&(left_prop.sym.clone(), Default::default()))
                                  {
                                    if !prop_info.is_used {
                                      *init = right.clone();
                                      pending_is_default = true;
                                      prop_pos += 1;
                                    } else {
                                      prop_pos += 2;
                                    }
                                  }
                                }
                              } else if let Expr::Member(MemberExpr {
                                prop: MemberProp::Ident(left_prop),
                                ..
                              }) = &**init
                              {
                                if let Some(prop_info) = props_info.get(&(left_prop.sym.clone(), Default::default())) {
                                  if !prop_info.is_used {
                                    *init = Box::new(Expr::Ident(quote_ident!("undefined").into()));
                                  }
                                  prop_pos += 1;
                                }
                              }
                            }
                            if prop_pos >= props_count {
                              break 'outer_loop;
                            }
                          }
                        }
                        curr_decl_pos += 1;
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}

impl Visit for Round1Visitor<'_> {
  fn visit_call_expr(&mut self, n: &CallExpr) {
    let callee = &n.callee;
    let params = &n.args;
    if let Callee::Expr(n) = callee {
      if let Expr::Ident(component) = &**n {
        if self.components.contains_key(&component.to_id()) {
          if let Some(component_info) = self.components.get_mut(&component.to_id()) {
            if let Some(ExprOrSpread { expr: n, .. }) = &params.get(0) {
              if let Expr::Object(n) = &**n {
                for prop in &n.props {
                  if let PropOrSpread::Prop(prop) = prop {
                    if let Prop::KeyValue(prop) = &**prop {
                      if let PropName::Ident(prop_name) = &prop.key {
                        if let Some(prop_info) = component_info.get_mut(&(prop_name.sym.clone(), Default::default())) {
                          prop_info.is_used = true;
                          if let Expr::Call(expr) = &*prop.value {
                            if let Some(ExprOrSpread { expr: n, .. }) = &expr.args.get(1) {
                              if let Expr::Array(expr) = &**n {
                                for elem in &expr.elems {
                                  if let Some(ExprOrSpread { expr: n, .. }) = elem {
                                    if let Expr::Ident(ident) = &**n {
                                      prop_info.deps.insert(ident.to_id());
                                    }
                                  }
                                }
                              }
                            }
                          } else if let Expr::Ident(ident) = &*prop.value {
                            prop_info.deps.insert(ident.to_id());
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
    n.visit_children_with(self);
  }
  fn visit_var_declarator(&mut self, n: &VarDeclarator) {
    if let Some(expr) = &n.init {
      if let Expr::Fn(FnExpr { function, .. }) = &**expr {
        if let Some(block_stmt) = &function.body {
          let is_component = if let Some(Stmt::Expr(ExprStmt { expr, .. })) = &block_stmt.stmts.get(0) {
            if let Expr::Lit(Lit::Str(Str { value, .. })) = &**expr {
              value == "use mango_component"
            } else {
              false
            }
          } else {
            false
          };
          if is_component {
            if let Pat::Ident(BindingIdent { id, .. }) = &n.name {
              let mut props_info: HashMap<Id, ComponentProp> = Default::default();
              if let Some(Stmt::Expr(ExprStmt { expr, .. })) = &block_stmt.stmts.get(1) {
                if let Expr::Lit(Lit::Str(Str { value, .. })) = &**expr {
                  let props_count = value[4..].parse::<i32>().unwrap();
                  if props_count > 0 {
                    let mut curr_decl_pos = 2;
                    let mut prop_pos = 0;
                    'outer_loop: while prop_pos < props_count {
                      while !matches!(&block_stmt.stmts.get(curr_decl_pos), Some(Stmt::Decl(Decl::Var(_)))) {
                        curr_decl_pos += 1;
                        prop_pos += 1;
                        if prop_pos > props_count {
                          break 'outer_loop;
                        }
                      }
                      if let Some(Stmt::Decl(Decl::Var(n))) = &block_stmt.stmts.get(curr_decl_pos) {
                        for declaration in &n.decls {
                          if let VarDeclarator {
                            name: Pat::Ident(BindingIdent { id, .. }),
                            init: Some(init),
                            ..
                          } = declaration
                          {
                            // Check if logical expression
                            if let Expr::Bin(BinExpr {
                              left, op: op!("||"), ..
                            }) = &**init
                            {
                              if let Expr::Member(MemberExpr {
                                prop: MemberProp::Ident(left_prop),
                                ..
                              }) = &**left
                              {
                                let prop_info = ComponentProp {
                                  local_name: id.to_id(),
                                  is_default: true,
                                  ..Default::default()
                                };
                                props_info.insert((left_prop.sym.clone(), Default::default()), prop_info);
                                prop_pos += 2;
                              }
                            } else if let Expr::Member(MemberExpr {
                              prop: MemberProp::Ident(left_prop),
                              ..
                            }) = &**init
                            {
                              let prop_info = ComponentProp {
                                local_name: id.to_id(),
                                is_default: false,
                                ..Default::default()
                              };
                              props_info.insert((left_prop.sym.clone(), Default::default()), prop_info);
                              prop_pos += 1;
                            }
                          }
                          if prop_pos >= props_count {
                            break 'outer_loop;
                          }
                        }
                      }
                      curr_decl_pos += 1;
                    }
                  }
                  self.components.insert(id.to_id(), props_info);
                }
              };
            };
          }
        }
      }
    }
    n.visit_children_with(self);
  }
}

#[plugin_transform]
pub fn process_transform(mut program: Program, _metadata: TransformPluginProgramMetadata) -> Program {
  let pass = &mut (
    resolver(Mark::new(), Mark::new(), false),
    visit_mut_pass(MainVisitor {
      comments: PluginCommentsProxy,
      components: Default::default(),
    }),
  );
  program.mutate(pass);
  program
}

#[test]
fn test_transform() {
  use std::sync::Arc;
  use std::time::Instant;

  use swc_core::common::comments::SingleThreadedComments;
  use swc_core::common::{FileName, SourceMap, GLOBALS};
  use swc_ecma_codegen::{text_writer::JsWriter, Config, Emitter};
  use swc_ecma_minifier::optimize;
  use swc_ecma_minifier::option::{CompressOptions, ExtraOptions, MangleOptions, MinifyOptions};
  use swc_ecma_parser::{parse_file_as_script, Syntax};
  use swc_ecma_transforms::fixer::fixer;

  #[no_mangle]
  fn transform(code: String) -> String {
    let cm: Arc<SourceMap> = Arc::default();
    let fm = cm.new_source_file(FileName::Anon.into(), code.clone());
    let comments = SingleThreadedComments::default();

    let mut errors = vec![];
    let res = parse_file_as_script(
      &fm,
      Syntax::Es(Default::default()),
      EsVersion::latest(),
      Some(&comments),
      &mut errors,
    );

    let program = match res {
      Ok(v) => Program::Script(v),
      Err(_) => panic!("failed to parse a js file as a script"),
    };

    let mut output = "".to_string();

    GLOBALS.set(&Default::default(), || {
      let unresolved_mark = Mark::new();
      let top_level_mark = Mark::new();

      let start = Instant::now();
      let program = program.apply(&mut resolver(unresolved_mark, top_level_mark, false));
      let duration = start.elapsed();
      println!("Resolver: {:?}", duration);

      let start = Instant::now();
      let mut program = optimize(
        program,
        cm.clone(),
        Some(&comments),
        None,
        &MinifyOptions {
          rename: false,
          compress: Some(CompressOptions {
            passes: 2,
            keep_fargs: false,
            negate_iife: false,
            side_effects: true,
            props: false,
            directives: false,
            ie8: true,
            ..Default::default()
          }),
          mangle: Some(MangleOptions {
            ie8: true,
            ..Default::default()
          }),
          wrap: false,
          enclose: false,
        },
        &ExtraOptions {
          unresolved_mark,
          top_level_mark,
          mangle_name_cache: Default::default(),
        },
      );
      let duration = start.elapsed();
      println!("Minifier: {:?}", duration);

      let start = Instant::now();
      let mut visitor = MainVisitor {
        comments: comments.clone(),
        components: Default::default(),
      };

      visitor.visit_mut_program(&mut program);
      let duration = start.elapsed();
      println!("Optimizer: {:?}", duration);

      let start = Instant::now();
      let program = optimize(
        program,
        cm.clone(),
        None,
        None,
        &MinifyOptions {
          rename: false,
          compress: Some(CompressOptions {
            passes: 2,
            keep_fargs: false,
            negate_iife: false,
            side_effects: true,
            props: false,
            directives: true,
            ie8: true,
            ..Default::default()
          }),
          mangle: Some(MangleOptions {
            ie8: true,
            ..Default::default()
          }),
          wrap: false,
          enclose: false,
        },
        &ExtraOptions {
          unresolved_mark,
          top_level_mark,
          mangle_name_cache: Default::default(),
        },
      );
      let duration = start.elapsed();
      println!("Minifier2: {:?}", duration);

      let program: Program = program.apply(&mut fixer(Some(&comments as &dyn Comments)));

      let mut src = vec![];
      let mut emitter = Emitter {
        cfg: Config::default().with_minify(true),
        comments: Some(&comments),
        cm: cm.clone(),
        wr: Box::new(JsWriter::new(cm.clone(), "\n", &mut src, None)),
      };

      emitter.emit_program(&program).unwrap();
      output = String::from_utf8(src).unwrap();
    });
    return output;
  }

  let code = r#"
var a = 50;
"#;

  let result = transform(code.to_string());
  println!("{}", result);
}
