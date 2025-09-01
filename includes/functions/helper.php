<?php

/**
 * Summary of apnmi_locate_template
 * 
 * @param mixed $file_path
 * @return bool|string
 */
function apnmi_locate_template($file_path)
{
    $template = apnmi_get_plugin_dir() . 'template/' . $file_path;

    if (file_exists($template)) {
        return $template;
    }

    return false;
}

/**
 * Summary of apnmi_inc_template
 * @param mixed $template_file
 * @param mixed $args
 * @param mixed $load_once
 * @return void
 */
function apnmi_inc_template($template_file, $args = [], $load_once = true)
{
    $get_template = apnmi_locate_template($template_file);

    if ($get_template) {
        if (!empty($args) && is_array($args)) {
            extract($args, EXTR_SKIP);
        }
        
        if ($load_once) {
            include_once $get_template;
        } else {
            include $get_template;
        }
    }
}

/**
 * Summary of apnmi_render_admin_template
 * Include the admin template file
 * 
 * @param mixed $template_file
 * @param mixed $args
 * @param mixed $load_once
 * @return void
 */
function apnmi_render_admin_template($template_file, $args = [], $load_once = true)
{
    $get_template = apnmi_locate_template('admin/' . $template_file);

    if ($get_template) {
        apnmi_inc_template($get_template, $args, $load_once);
    }
}

/**
 * Render the public template file
 *
 * @param mixed $template_file
 * @param mixed $args
 * @param mixed $load_once
 * @return void
 */
function apnmi_render_public_template($template_file, $args = [], $load_once = true)
{
    $get_template = apnmi_locate_template('public/' . $template_file);
    
    if ($get_template) {
        apnmi_inc_template($get_template, $args, $load_once);
    }
}